import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { roomSquadSizeSchema } from "@/lib/domain/schemas";
import { handleRouteError } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { getAuctionStateOnly, requireRoomMember } from "@/lib/server/room";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const authUser = await requireApiUser();
    const { room, member } = await requireRoomMember(code, authUser.id);

    if (!member.isAdmin) {
      throw new AppError("Only admins can change room squad size.", 403, "ROOM_ACCESS_DENIED");
    }

    const auctionState = await getAuctionStateOnly(room.id);
    if (auctionState && (auctionState.phase === "LIVE" || auctionState.phase === "PAUSED")) {
      throw new AppError(
        "Pause-ending changes are blocked while the auction is live. Finish or end the live window first.",
        400,
        "AUCTION_LIVE",
      );
    }

    const rawBody = await request.json();
    const input = roomSquadSizeSchema.parse(rawBody);
    const admin = getSupabaseAdminClient();

    const { error: roomError } = await admin
      .from("rooms")
      .update({ squad_size: input.squadSize })
      .eq("id", room.id);

    if (roomError) {
      throw new AppError(roomError.message, 500, "ROOM_UPDATE_FAILED");
    }

    const { error: teamError } = await admin
      .from("teams")
      .update({ squad_limit: input.squadSize })
      .eq("room_id", room.id);

    if (teamError) {
      throw new AppError(teamError.message, 500, "TEAM_UPDATE_FAILED");
    }

    revalidatePath(`/room/${room.code}`);
    revalidatePath(`/auction/${room.code}`);

    return NextResponse.json({ squadSize: input.squadSize });
  } catch (error) {
    return handleRouteError(error);
  }
}
