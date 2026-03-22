import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { teamUploadSchema } from "@/lib/domain/schemas";
import { normalizeTeamRows } from "@/lib/domain/upload";
import { readJson, handleRouteError } from "@/lib/server/api";
import { requireApiUser, syncUserProfileFromAuthUser } from "@/lib/server/auth";
import { getRoomEntities, requireRoomAdmin } from "@/lib/server/room";
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
    const input = await readJson(request, teamUploadSchema);
    const admin = getSupabaseAdminClient();
    const { auctionState } = await getRoomEntities(room.id);
    const normalizedTeams = normalizeTeamRows(input.teams);

    if (auctionState && auctionState.phase !== "WAITING") {
      throw new AppError(
        "Team uploads are locked once the auction has started.",
        400,
        "AUCTION_ALREADY_STARTED",
      );
    }
    const rows = normalizedTeams.map((team) => ({
      room_id: room.id,
      name: team.name,
      short_code: team.shortCode,
      purse_remaining: room.purse,
      squad_limit: room.squadSize,
      owner_user_id: team.ownerUserId,
    }));

    const { error } = await admin.from("teams").upsert(rows, {
      onConflict: "room_id,name",
    });

    if (error) {
      throw new AppError(error.message, 500, "TEAM_IMPORT_FAILED");
    }

    revalidatePath(`/room/${room.code}`);
    revalidatePath(`/auction/${room.code}`);
    revalidatePath(`/results/${room.code}`);

    return NextResponse.json({ imported: rows.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
