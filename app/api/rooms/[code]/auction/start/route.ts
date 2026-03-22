import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { buildStartingAuctionState } from "@/lib/domain/auction";
import { AppError } from "@/lib/domain/errors";
import { handleRouteError } from "@/lib/server/api";
import { requireApiUser, syncUserProfileFromAuthUser } from "@/lib/server/auth";
import { getRoomEntities, requireRoomAdmin } from "@/lib/server/room";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const authUser = await requireApiUser();
    await syncUserProfileFromAuthUser(authUser);
    const { room } = await requireRoomAdmin(code, authUser.id);
    const admin = getSupabaseAdminClient();
    const { players, teams, auctionState } = await getRoomEntities(room.id);

    if (players.length === 0) {
      throw new AppError("Upload players before starting the auction.", 400, "NO_PLAYERS");
    }

    if (teams.length < 1) {
      throw new AppError("Create at least one team before starting.", 400, "NO_TEAMS");
    }

    if (auctionState && auctionState.phase !== "WAITING") {
      throw new AppError("Auction has already started.", 400, "AUCTION_ALREADY_STARTED");
    }

    const nextState = buildStartingAuctionState({
      room,
      players,
      now: new Date(),
    });

    const version = (auctionState?.version ?? 0) + 1;
    const { error } = await admin.from("auction_state").upsert({
      room_id: room.id,
      phase: nextState.phase,
      current_round: nextState.currentRound,
      current_player_id: nextState.currentPlayerId,
      current_bid: nextState.currentBid,
      current_team_id: nextState.currentTeamId,
      expires_at: nextState.expiresAt,
      version,
      last_event: nextState.lastEvent,
    });

    if (error) {
      throw new AppError(error.message, 500, "AUCTION_START_FAILED");
    }

    revalidatePath(`/room/${room.code}`);
    revalidatePath(`/auction/${room.code}`);
    revalidatePath(`/results/${room.code}`);

    return NextResponse.json({ started: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
