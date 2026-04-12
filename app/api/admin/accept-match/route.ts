/**
 * POST /api/admin/accept-match
 *
 * Global admin only. Accepts a single match-source pair and pushes
 * the stats to every room in the system.
 *
 * Body: { matchId: string, source: string }
 *
 * Flow:
 *  1. Mark global_match_results row as accepted
 *  2. Unaccept all other sources for the same matchId (one source per match)
 *  3. Call pushMatchToAllRooms() → upserts match_results + updates players.stats in all rooms
 *  4. Return { roomsUpdated, playersUpdated }
 */

import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { handleRouteError } from "@/lib/server/api";
import { requireSuperAdmin } from "@/lib/server/auth";
import { pushMatchToAllRooms } from "@/lib/server/score-push";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const admin = getSupabaseAdminClient();

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const matchId = typeof body.matchId === "string" ? body.matchId.trim() : "";
    const source = typeof body.source === "string" ? body.source.trim() : "";

    if (!matchId || !source) {
      throw new AppError("matchId and source are required.", 400, "NO_DATA");
    }

    // Accept the chosen source row
    const { error: acceptError } = await admin
      .from("global_match_results")
      .update({ accepted: true, accepted_at: new Date().toISOString() })
      .eq("match_id", matchId)
      .eq("source", source);

    if (acceptError) {
      throw new AppError(acceptError.message, 500, "DB_QUERY_FAILED");
    }

    // Unaccept any other source rows for this matchId (only one canonical source per match)
    await admin
      .from("global_match_results")
      .update({ accepted: false, accepted_at: null })
      .eq("match_id", matchId)
      .neq("source", source);

    // Push to all rooms
    const { roomsUpdated, playersUpdated } = await pushMatchToAllRooms(matchId, source);

    return NextResponse.json({ ok: true, matchId, source, roomsUpdated, playersUpdated });
  } catch (error) {
    return handleRouteError(error);
  }
}
