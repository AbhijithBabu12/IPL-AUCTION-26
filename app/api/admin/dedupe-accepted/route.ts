/**
 * POST /api/admin/dedupe-accepted
 *
 * Global admin only. One-time cleanup + ongoing guard:
 *   1. Scans every room for match_results rows where >1 source is
 *      accepted for the same physical match (detected by match_date).
 *   2. Keeps the source with the highest priority (rapidapi > cricsheet).
 *      Tie-break: latest accepted_at within same priority.
 *   3. Marks all other accepted rows for that date as accepted=false.
 *   4. Recalculates player stats for every affected room.
 *   5. Returns a detailed simulation report.
 *
 * Query params:
 *   ?dry=true   — simulate only, make NO database changes (default: false)
 *   ?room=CODE  — limit to a single room code (optional)
 */

import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/server/api";
import { requireSuperAdmin } from "@/lib/server/auth";
import { recalculateRoomStats } from "@/lib/server/score-push";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Higher index = lower priority (cricsheet loses to rapidapi)
const SOURCE_PRIORITY_ORDER = ["rapidapi", "cricsheet"];

function sourcePriority(source: string): number {
  const idx = SOURCE_PRIORITY_ORDER.indexOf(source);
  return idx === -1 ? SOURCE_PRIORITY_ORDER.length : idx; // lower = higher priority
}

function pickWinner(rows: Array<{ match_id: string; source: string; accepted_at: string | null }>): string {
  // Primary: source priority (rapidapi > cricsheet)
  // Tie-break within same priority: latest accepted_at
  const sorted = [...rows].sort((a, b) => {
    const pa = sourcePriority(a.source);
    const pb = sourcePriority(b.source);
    if (pa !== pb) return pa - pb;
    const tA = a.accepted_at ? new Date(a.accepted_at).getTime() : 0;
    const tB = b.accepted_at ? new Date(b.accepted_at).getTime() : 0;
    return tB - tA;
  });
  return sorted[0]!.source;
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const admin = getSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dry") === "true";
    const limitRoom = searchParams.get("room") ?? null;

    // 1. Determine which rooms to scan
    const roomQuery = admin.from("rooms").select("id, code");
    const { data: rooms, error: roomsErr } = limitRoom
      ? await roomQuery.eq("code", limitRoom)
      : await roomQuery;

    if (roomsErr) throw new Error(roomsErr.message);
    if (!rooms || rooms.length === 0) {
      return NextResponse.json({ ok: true, dryRun, rooms: [] });
    }

    const report: Array<{
      roomCode: string;
      roomId: string;
      duplicateGroups: number;
      duplicateDetails: Array<{
        matchDate: string;
        acceptedSources: Array<{ match_id: string; source: string; accepted_at: string | null }>;
        winner: string;
        revoked: string[];
      }>;
      totalRevokedRows: number;
      pointsBefore: number;
      pointsAfter: number | null;
      playersRecalculated: number | null;
    }> = [];

    for (const room of rooms) {
      // Fetch all accepted match_results for this room
      const { data: accepted } = await admin
        .from("match_results")
        .select("match_id, source, match_date, accepted_at, calculated_points")
        .eq("room_id", room.id)
        .eq("accepted", true)
        .order("match_date", { ascending: true });

      if (!accepted || accepted.length === 0) {
        report.push({
          roomCode: room.code,
          roomId: room.id,
          duplicateGroups: 0,
          duplicateDetails: [],
          totalRevokedRows: 0,
          pointsBefore: 0,
          pointsAfter: 0,
          playersRecalculated: null,
        });
        continue;
      }

      // Compute total points before
      let pointsBefore = 0;
      for (const row of accepted) {
        const pts = row.calculated_points as Record<string, number> | null;
        if (pts && typeof pts === "object") {
          pointsBefore += Object.values(pts).reduce((s: number, v) => s + (typeof v === "number" ? v : 0), 0);
        }
      }

      // Group accepted rows by match_date to find duplicates
      const byDate = new Map<string, Array<{ match_id: string; source: string; accepted_at: string | null }>>();
      for (const row of accepted) {
        const date = String(row.match_date ?? "unknown");
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push({
          match_id: String(row.match_id),
          source: String(row.source),
          accepted_at: row.accepted_at ? String(row.accepted_at) : null,
        });
      }

      const duplicateDetails: (typeof report)[number]["duplicateDetails"] = [];
      const toRevoke: string[] = []; // match_ids to set accepted=false

      for (const [date, rows] of byDate.entries()) {
        if (rows.length <= 1) continue; // no conflict on this date

        const winner = pickWinner(rows);
        const revoked = rows.filter((r) => r.source !== winner).map((r) => r.match_id);
        toRevoke.push(...revoked);

        duplicateDetails.push({
          matchDate: date,
          acceptedSources: rows,
          winner,
          revoked,
        });
      }

      let pointsAfter: number | null = null;
      let playersRecalculated: number | null = null;

      if (!dryRun && toRevoke.length > 0) {
        // Revoke the losers
        await admin
          .from("match_results")
          .update({ accepted: false, accepted_at: null })
          .eq("room_id", room.id)
          .in("match_id", toRevoke);

        // Recalculate stats for this room
        const { playersUpdated } = await recalculateRoomStats(room.id, room.code);
        playersRecalculated = playersUpdated;

        // Recompute points after
        const { data: remaining } = await admin
          .from("match_results")
          .select("calculated_points")
          .eq("room_id", room.id)
          .eq("accepted", true);

        pointsAfter = 0;
        for (const row of remaining ?? []) {
          const pts = row.calculated_points as Record<string, number> | null;
          if (pts && typeof pts === "object") {
            pointsAfter += Object.values(pts).reduce((s: number, v) => s + (typeof v === "number" ? v : 0), 0);
          }
        }
      }

      report.push({
        roomCode: room.code,
        roomId: room.id,
        duplicateGroups: duplicateDetails.length,
        duplicateDetails,
        totalRevokedRows: toRevoke.length,
        pointsBefore,
        pointsAfter,
        playersRecalculated,
      });
    }

    const totalDuplicateGroups = report.reduce((s, r) => s + r.duplicateGroups, 0);
    const totalRevoked = report.reduce((s, r) => s + r.totalRevokedRows, 0);

    return NextResponse.json({
      ok: true,
      dryRun,
      summary: {
        roomsScanned: rooms.length,
        roomsWithDuplicates: report.filter((r) => r.duplicateGroups > 0).length,
        totalDuplicateGroups,
        totalRevokedRows: totalRevoked,
      },
      rooms: report,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
