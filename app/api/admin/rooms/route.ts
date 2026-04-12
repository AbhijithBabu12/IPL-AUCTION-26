/**
 * GET /api/admin/rooms
 *
 * Global admin only. Returns all rooms with player counts, team counts,
 * member counts, auction phase, and last score sync timestamp.
 */

import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/server/api";
import { requireSuperAdmin } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSuperAdmin();
    const admin = getSupabaseAdminClient();

    const [
      { data: rooms, error: roomsError },
      { data: playerCounts, error: playerError },
      { data: teamCounts, error: teamError },
      { data: memberCounts, error: memberError },
      { data: auctionStates, error: auctionError },
      { data: lastPushes, error: pushError },
    ] = await Promise.all([
      admin.from("rooms").select("id, code, name, purse, squad_size, owner_id, created_at").order("created_at"),
      admin.from("players").select("room_id"),
      admin.from("teams").select("room_id"),
      admin.from("room_members").select("room_id"),
      admin.from("auction_state").select("room_id, phase"),
      admin
        .from("match_results")
        .select("room_id, pushed_at:accepted_at")
        .eq("accepted", true)
        .order("accepted_at", { ascending: false }),
    ]);

    if (roomsError) throw new Error(roomsError.message);
    if (playerError || teamError || memberError || auctionError || pushError) {
      console.warn("[admin/rooms] non-fatal aggregation error", { playerError, teamError, memberError, auctionError, pushError });
    }

    // Build count maps
    const playersByRoom = new Map<string, number>();
    for (const row of playerCounts ?? []) {
      const id = String(row.room_id);
      playersByRoom.set(id, (playersByRoom.get(id) ?? 0) + 1);
    }

    const teamsByRoom = new Map<string, number>();
    for (const row of teamCounts ?? []) {
      const id = String(row.room_id);
      teamsByRoom.set(id, (teamsByRoom.get(id) ?? 0) + 1);
    }

    const membersByRoom = new Map<string, number>();
    for (const row of memberCounts ?? []) {
      const id = String(row.room_id);
      membersByRoom.set(id, (membersByRoom.get(id) ?? 0) + 1);
    }

    const phaseByRoom = new Map<string, string>();
    for (const row of auctionStates ?? []) {
      phaseByRoom.set(String(row.room_id), String(row.phase));
    }

    // Last push per room (first row is most recent due to desc ordering)
    const lastPushByRoom = new Map<string, string>();
    for (const row of lastPushes ?? []) {
      const id = String(row.room_id);
      if (!lastPushByRoom.has(id) && row.pushed_at) {
        lastPushByRoom.set(id, String(row.pushed_at));
      }
    }

    const result = (rooms ?? []).map((room) => ({
      id: room.id,
      code: room.code,
      name: room.name,
      purse: room.purse,
      squadSize: room.squad_size,
      createdAt: room.created_at,
      players: playersByRoom.get(String(room.id)) ?? 0,
      teams: teamsByRoom.get(String(room.id)) ?? 0,
      members: membersByRoom.get(String(room.id)) ?? 0,
      auctionPhase: phaseByRoom.get(String(room.id)) ?? "WAITING",
      lastSync: lastPushByRoom.get(String(room.id)) ?? null,
    }));

    return NextResponse.json({ ok: true, rooms: result });
  } catch (error) {
    return handleRouteError(error);
  }
}
