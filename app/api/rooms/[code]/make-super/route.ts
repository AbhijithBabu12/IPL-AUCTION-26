/**
 * POST /api/rooms/[code]/make-super
 *
 * Room admin only. Marks this room as a super room (is_super_room = true).
 *
 * What changes when a room becomes a super room:
 *   - Excluded from all global score pushes (pushMatchToAllRooms)
 *   - Hidden from the lobby listing
 *   - Gains Cricsheet Sync + Live Score Sync in the room panel
 *   - DB-level reset available in the admin panel
 *   - This action is irreversible via the UI.
 */
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { handleRouteError } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { requireRoomAdmin } from "@/lib/server/room";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const authUser = await requireApiUser();
    const { room } = await requireRoomAdmin(code, authUser.id);

    if (room.isSuperRoom) {
      return NextResponse.json({ ok: true, alreadySuperRoom: true });
    }

    const admin = getSupabaseAdminClient();

    const { error } = await admin
      .from("rooms")
      .update({ is_super_room: true })
      .eq("id", room.id);

    if (error) throw new AppError(error.message, 500, "ROOM_UPDATE_FAILED");

    revalidatePath(`/room/${code}`);
    revalidatePath(`/results/${code}`);

    return NextResponse.json({ ok: true, alreadySuperRoom: false });
  } catch (error) {
    return handleRouteError(error);
  }
}
