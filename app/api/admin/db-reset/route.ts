/**
 * POST /api/admin/db-reset
 *
 * Superadmin only. Nuclear option: zeroes all player stats AND deletes all
 * match_results rows for the target scope.
 *
 * Body: { roomCode?: string }
 *   roomCode provided → wipe that room only
 *   roomCode omitted  → wipe ALL normal rooms (super room excluded)
 *
 * Use reset-points + recalculate-points for non-destructive soft reset.
 */
import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { handleRouteError } from "@/lib/server/api";
import { requireSuperAdmin } from "@/lib/server/auth";
import { resetRoomStats } from "@/lib/server/score-push";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const admin = getSupabaseAdminClient();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const roomCode = typeof body.roomCode === "string" ? body.roomCode.trim().toUpperCase() : null;

    let rooms: Array<{ id: unknown; code: unknown }>;

    if (roomCode) {
      const { data: room, error } = await admin
        .from("rooms")
        .select("id, code")
        .eq("code", roomCode)
        .maybeSingle();
      if (error) throw new AppError(error.message, 500, "DB_QUERY_FAILED");
      if (!room) throw new AppError(`Room not found: ${roomCode}`, 404, "NOT_FOUND");
      rooms = [room];
    } else {
      const { data, error } = await admin
        .from("rooms")
        .select("id, code");
      if (error) throw new AppError(error.message, 500, "DB_QUERY_FAILED");
      rooms = data ?? [];
    }

    let totalPlayersReset = 0;
    let totalMatchRowsDeleted = 0;

    for (const room of rooms) {
      const { playersReset } = await resetRoomStats(String(room.id), String(room.code));
      totalPlayersReset += playersReset;

      const { error: delError, count } = await admin
        .from("match_results")
        .delete({ count: "exact" })
        .eq("room_id", String(room.id));

      if (delError) throw new AppError(delError.message, 500, "MATCH_RESULTS_RESET_FAILED");
      totalMatchRowsDeleted += count ?? 0;
    }

    return NextResponse.json({
      ok: true,
      roomsReset: rooms.length,
      playersReset: totalPlayersReset,
      matchRowsDeleted: totalMatchRowsDeleted,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
