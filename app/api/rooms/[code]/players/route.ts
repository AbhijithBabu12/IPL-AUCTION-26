import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { playerUploadSchema, removePlayersSchema } from "@/lib/domain/schemas";
import { readJson, handleRouteError } from "@/lib/server/api";
import { requireApiUser, syncUserProfileFromAuthUser } from "@/lib/server/auth";
import { insertPlayersIntoRoom } from "@/lib/server/player-import";
import { getAuctionStateOnly, requireRoomAdmin } from "@/lib/server/room";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const authUser = await requireApiUser();
    await syncUserProfileFromAuthUser(authUser);
    const { room } = await requireRoomAdmin(code, authUser.id);
    const input = await readJson(request, playerUploadSchema);
    const result = await insertPlayersIntoRoom(room, input.players);

    revalidatePath(`/room/${room.code}`);
    revalidatePath(`/auction/${room.code}`);
    revalidatePath(`/results/${room.code}`);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const authUser = await requireApiUser();
    await syncUserProfileFromAuthUser(authUser);
    const { room } = await requireRoomAdmin(code, authUser.id);
    const input = await readJson(request, removePlayersSchema);
    const admin = getSupabaseAdminClient();
    const auctionState = await getAuctionStateOnly(room.id);

    if (auctionState && !["WAITING", "COMPLETED"].includes(auctionState.phase)) {
      throw new AppError(
        "Players can only be removed before the auction starts or after it is completed.",
        400,
        "AUCTION_LOCKED",
      );
    }

    let deletedCount = 0;

    if (input.removeAll) {
      const { data, error } = await admin
        .from("players")
        .delete()
        .eq("room_id", room.id)
        .select("id");

      if (error) {
        throw new AppError(error.message, 500, "PLAYER_DELETE_FAILED");
      }

      deletedCount = data?.length ?? 0;
    } else {
      const { data, error } = await admin
        .from("players")
        .delete()
        .eq("room_id", room.id)
        .in("id", input.playerIds ?? [])
        .select("id");

      if (error) {
        throw new AppError(error.message, 500, "PLAYER_DELETE_FAILED");
      }

      deletedCount = data?.length ?? 0;
    }

    revalidatePath(`/room/${room.code}`);
    revalidatePath(`/auction/${room.code}`);
    revalidatePath(`/results/${room.code}`);

    return NextResponse.json({ deleted: deletedCount });
  } catch (error) {
    return handleRouteError(error);
  }
}
