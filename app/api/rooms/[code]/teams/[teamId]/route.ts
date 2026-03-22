import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { teamRenameSchema } from "@/lib/domain/schemas";
import { readJson, handleRouteError } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { getAuctionStateOnly, getRoomEntities, requireRoomMember } from "@/lib/server/room";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string; teamId: string }> },
) {
  try {
    const { code, teamId } = await context.params;
    const authUser = await requireApiUser();
    const { room, member } = await requireRoomMember(code, authUser.id);
    const input = await readJson(request, teamRenameSchema);
    const admin = getSupabaseAdminClient();

    const auctionState = await getAuctionStateOnly(room.id);

    // Block rename during live auction
    if (auctionState && auctionState.phase === "LIVE") {
      throw new AppError(
        "Team names cannot be changed while the auction is live. Pause first.",
        400,
        "AUCTION_LIVE",
      );
    }

    const { teams } = await getRoomEntities(room.id);
    const team = teams.find((t) => t.id === teamId);

    if (!team) {
      throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");
    }

    // Only the team owner or admin can rename
    if (!member.isAdmin && team.ownerUserId !== authUser.id) {
      throw new AppError("You can only rename your own team.", 403, "TEAM_ACCESS_DENIED");
    }

    const { error } = await admin
      .from("teams")
      .update({ name: input.name })
      .eq("id", teamId)
      .eq("room_id", room.id);

    if (error) {
      throw new AppError(error.message, 500, "TEAM_RENAME_FAILED");
    }

    revalidatePath(`/auction/${room.code}`);
    revalidatePath(`/room/${room.code}`);

    return NextResponse.json({ name: input.name });
  } catch (error) {
    return handleRouteError(error);
  }
}
