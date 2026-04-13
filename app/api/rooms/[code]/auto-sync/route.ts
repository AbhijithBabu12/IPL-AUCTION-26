/**
 * GET  /api/rooms/[code]/auto-sync
 *   Returns the list of configured API providers available for score fetching.
 *   Requires room membership + user_score_fetch flag ON (or room admin always).
 *
 * POST /api/rooms/[code]/auto-sync
 *   Body: { season?: string, provider?: "rapidapi" }
 *   Fetches live IPL scores from the chosen provider, auto-accepts all new
 *   matches, and rebuilds player stats. No manual review step.
 *   Requires room membership + user_score_fetch flag ON (or room admin always).
 */

import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { handleRouteError } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { requireRoomMember } from "@/lib/server/room";
import { recalculateRoomStats } from "@/lib/server/score-push";
import { getFeatureFlags } from "@/lib/server/settings";
import {
  availableProviders,
  fetchIPLMatchesFromProvider,
  fetchIPLMatchesWithFallback,
  getProviderLabel,
  type WebscrapeProviderId,
} from "@/lib/server/webscrape/index";
import { computeMatchPoints } from "@/lib/server/webscrape/parser";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isProviderId(v: unknown): v is WebscrapeProviderId {
  return v === "rapidapi";
}

async function checkAccess(code: string, userId: string) {
  const { room, member } = await requireRoomMember(code, userId);
  if (!member.isAdmin) {
    const flags = await getFeatureFlags();
    if (!flags.user_score_fetch) {
      throw new AppError(
        "Score fetching is currently managed by the admin.",
        403,
        "FEATURE_DISABLED",
      );
    }
  }
  return { room, member };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const authUser = await requireApiUser();
    await checkAccess(code, authUser.id);
    return NextResponse.json({ ok: true, providers: availableProviders() });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const authUser = await requireApiUser();
    const { room } = await checkAccess(code, authUser.id);

    const admin = getSupabaseAdminClient();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const season = String(body.season ?? "2026");
    const requestedProvider = isProviderId(body.provider) ? body.provider : null;

    const providers = availableProviders();
    if (!providers.some((p) => p.configured)) {
      return NextResponse.json(
        { ok: false, error: "No cricket API keys configured on this server." },
        { status: 400 },
      );
    }

    if (requestedProvider && !providers.some((p) => p.id === requestedProvider && p.configured)) {
      return NextResponse.json(
        { ok: false, error: `${getProviderLabel(requestedProvider)} is not configured.`, providers },
        { status: 400 },
      );
    }

    // Fetch from the chosen provider (or auto-fallback)
    let fetchResult;
    try {
      fetchResult = requestedProvider
        ? await fetchIPLMatchesFromProvider(requestedProvider, season)
        : await fetchIPLMatchesWithFallback(season);
    } catch (err) {
      const label = requestedProvider ? getProviderLabel(requestedProvider) : "any provider";
      return NextResponse.json(
        { ok: false, error: `Could not fetch from ${label}: ${err instanceof Error ? err.message : String(err)}`, providers },
        { status: 400 },
      );
    }

    const { matches, source, errors } = fetchResult;
    if (matches.length === 0) {
      return NextResponse.json(
        { ok: false, error: `No completed IPL ${season} matches found from this provider.`, errors, providers },
        { status: 404 },
      );
    }

    // Find already-accepted matches in this room to skip them
    const { data: existingRows } = await admin
      .from("match_results")
      .select("match_id, source, accepted")
      .eq("room_id", room.id)
      .eq("season", season);

    const acceptedKeys = new Set(
      (existingRows ?? [])
        .filter((r) => r.accepted)
        .map((r) => `${String(r.match_id)}::${String(r.source)}`),
    );

    const newMatches = matches.filter(
      (m) => !acceptedKeys.has(`${m.matchId}::${m.source}`),
    );
    const alreadyAccepted = matches.length - newMatches.length;

    // Upsert new matches directly as accepted=true (auto-accept, no review step)
    for (const m of newMatches) {
      const calculatedPoints: Record<string, number> = {};
      for (const [playerName, stats] of Object.entries(m.playerStats)) {
        calculatedPoints[playerName] = computeMatchPoints(stats);
      }

      await admin.from("match_results").upsert(
        {
          room_id: room.id,
          match_id: m.matchId,
          match_date: m.matchDate || null,
          season,
          teams: [m.homeTeam, m.awayTeam],
          source: m.source,
          source_label: m.sourceLabel,
          player_stats: m.playerStats as unknown as Record<string, unknown>,
          calculated_points: calculatedPoints as unknown as Record<string, unknown>,
          accepted: true,
          accepted_at: new Date().toISOString(),
        },
        { onConflict: "room_id,match_id,source" },
      );
    }

    const { playersUpdated } = newMatches.length > 0
      ? await recalculateRoomStats(room.id, room.code)
      : { playersUpdated: 0 };

    return NextResponse.json({
      ok: true,
      source,
      provider: requestedProvider ?? source,
      matchesFetched: newMatches.length,
      matchesAlreadyAccepted: alreadyAccepted,
      playersUpdated,
      errors,
      providers,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
