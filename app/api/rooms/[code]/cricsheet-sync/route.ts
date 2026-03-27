/**
 * POST /api/rooms/[code]/cricsheet-sync
 *
 * Parses a Cricsheet IPL ZIP (uploaded or fetched from cricsheet.org) and
 * upserts ONE row per match into the `match_results` table with:
 *   source    = "cricsheet"
 *   accepted  = false  (admin must accept via the webscrape-accept route)
 *
 * This allows the admin to review individual Cricsheet match data alongside
 * webscrape data and accept the best source per match — exactly the same
 * workflow as the existing webscrape comparison UI.
 *
 * The webscrape-accept route already aggregates ALL accepted rows (any source)
 * and writes the totals to players.stats, so no further work is needed here.
 *
 * Body (JSON):  { season?: string }
 * Body (form):  multipart/form-data with fields file (ZIP) and season
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { handleRouteError } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { processZipPerMatch } from "@/lib/server/cricsheet";
import { requireRoomAdmin } from "@/lib/server/room";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const authUser = await requireApiUser();
    const { room } = await requireRoomAdmin(code, authUser.id);
    const admin = getSupabaseAdminClient();

    // ── Get ZIP buffer ────────────────────────────────────────────────────────
    let zipBuffer: Buffer;
    let season: string;

    const ct = request.headers.get("content-type") ?? "";

    if (ct.includes("multipart/form-data")) {
      // Admin uploaded the ZIP manually
      const form = await request.formData();
      const file = form.get("file") as File | null;
      season = String(form.get("season") || "2026");
      if (!file) throw new AppError("No file uploaded.", 400, "NO_FILE");
      zipBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      // Fetch directly from Cricsheet
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      season = String(body.season ?? "2026");

      // Try season-specific download first (smaller), fall back to full archive
      const urls = [
        `https://cricsheet.org/downloads/ipl_${season}_json.zip`,
        "https://cricsheet.org/downloads/ipl_json.zip",
      ];

      let fetchRes: Response | null = null;
      for (const url of urls) {
        const res = await fetch(url, {
          headers: { "User-Agent": "IPL-Auction-Platform/1.0 (fantasy-scoring)" },
          signal: AbortSignal.timeout(90_000), // 90 s max
        });
        if (res.ok) { fetchRes = res; break; }
      }

      if (!fetchRes) {
        throw new AppError(
          "Could not fetch IPL data from Cricsheet. Try uploading the ZIP manually.",
          502,
          "CRICSHEET_FETCH_FAILED",
        );
      }

      zipBuffer = Buffer.from(await fetchRes.arrayBuffer());
    }

    // ── Parse ZIP into per-match records ──────────────────────────────────────
    const { matches, matchesProcessed, matchesSkipped, seasons } =
      processZipPerMatch(zipBuffer, season);

    if (matchesProcessed === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `No IPL matches found for season ${season}. Available seasons in file: ${seasons.join(", ") || "none"}.`,
          matchesProcessed,
          matchesSkipped,
          seasons,
        },
        { status: 404 },
      );
    }

    // ── Upsert each match into match_results ──────────────────────────────────
    // We upsert (not just insert) so re-running the sync updates stale rows.
    // accepted is NOT changed for existing rows — if the admin already accepted
    // a cricsheet row we preserve that decision.
    let upserted = 0;
    let upsertErrors = 0;

    for (const m of matches) {
      // Check if there's already a row for this match+source — if it is already
      // accepted, we update the player_stats but keep accepted=true.
      const { data: existing } = await admin
        .from("match_results")
        .select("id, accepted")
        .eq("room_id", room.id)
        .eq("match_id", m.matchId)
        .eq("source", "cricsheet")
        .eq("season", m.season || season)
        .maybeSingle();

      const row = {
        room_id: room.id,
        match_id: m.matchId,
        source: "cricsheet" as const,
        season: m.season || season,
        match_date: m.matchDate,
        player_stats: m.playerStats as unknown as Record<string, unknown>,
        // Only set accepted=false on brand-new rows; preserve existing decisions
        ...(existing ? {} : { accepted: false }),
      };

      const { error } = existing
        ? await admin
            .from("match_results")
            .update({
              match_date: m.matchDate,
              player_stats: m.playerStats as unknown as Record<string, unknown>,
            })
            .eq("id", existing.id as string)
        : await admin.from("match_results").insert(row);

      if (error) {
        console.error(`cricsheet-sync: failed to upsert match ${m.matchId}:`, error.message);
        upsertErrors += 1;
      } else {
        upserted += 1;
      }
    }

    revalidatePath(`/room/${room.code}`);
    revalidatePath(`/results/${room.code}`);

    return NextResponse.json({
      ok: true,
      season,
      seasons,
      matchesProcessed,
      matchesSkipped,
      matchesUpserted: upserted,
      matchesErrored: upsertErrors,
      message:
        `Cricsheet data stored as pending match_results rows. ` +
        `Use the match review UI to accept individual matches and update player scores.`,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
