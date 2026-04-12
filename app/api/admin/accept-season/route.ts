/**
 * POST /api/admin/accept-season
 *
 * Global admin only. Bulk-accepts all pending (unaccepted) global matches
 * for a season that have a single unambiguous source, then pushes each to
 * all rooms sequentially.
 *
 * Body: { season: string, source?: string }
 *   source  — optional; if provided, only accepts rows from that source.
 *             If omitted, accepts the best available source per match
 *             (prefers 'cricsheet', then falls back to whatever is stored).
 *
 * Returns a summary of what was accepted and pushed.
 */

import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { handleRouteError } from "@/lib/server/api";
import { requireSuperAdmin } from "@/lib/server/auth";
import { pushMatchToAllRooms } from "@/lib/server/score-push";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SOURCE_PRIORITY = ["cricsheet", "cricketdata", "rapidapi", "atd"];

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const admin = getSupabaseAdminClient();

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const season = String(body.season ?? "2026");
    const preferredSource = typeof body.source === "string" ? body.source : null;

    // Fetch all unaccepted global matches for this season
    const { data: pending, error: fetchError } = await admin
      .from("global_match_results")
      .select("match_id, source, accepted")
      .eq("season", season)
      .eq("accepted", false);

    if (fetchError) throw new AppError(fetchError.message, 500, "DB_QUERY_FAILED");
    if (!pending || pending.length === 0) {
      return NextResponse.json({ ok: true, season, accepted: 0, pushed: 0, message: "No pending matches for this season." });
    }

    // Group by matchId to choose the best source per match
    const byMatchId = new Map<string, string[]>();
    for (const row of pending) {
      const matchId = String(row.match_id);
      if (!byMatchId.has(matchId)) byMatchId.set(matchId, []);
      byMatchId.get(matchId)!.push(String(row.source));
    }

    const toAccept: Array<{ matchId: string; source: string }> = [];

    for (const [matchId, sources] of byMatchId.entries()) {
      if (preferredSource && sources.includes(preferredSource)) {
        toAccept.push({ matchId, source: preferredSource });
        continue;
      }
      // Pick highest-priority available source
      const chosen = SOURCE_PRIORITY.find((s) => sources.includes(s)) ?? sources[0];
      if (chosen) toAccept.push({ matchId, source: chosen });
    }

    let accepted = 0;
    let pushed = 0;
    const errors: string[] = [];

    for (const { matchId, source } of toAccept) {
      // Mark accepted, clear other sources
      const { error: acceptErr } = await admin
        .from("global_match_results")
        .update({ accepted: true, accepted_at: new Date().toISOString() })
        .eq("match_id", matchId)
        .eq("source", source);

      if (acceptErr) { errors.push(`${matchId}: ${acceptErr.message}`); continue; }
      accepted += 1;

      await admin
        .from("global_match_results")
        .update({ accepted: false, accepted_at: null })
        .eq("match_id", matchId)
        .neq("source", source);

      try {
        await pushMatchToAllRooms(matchId, source);
        pushed += 1;
      } catch (pushErr) {
        errors.push(`push ${matchId}: ${pushErr instanceof Error ? pushErr.message : String(pushErr)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      season,
      accepted,
      pushed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
