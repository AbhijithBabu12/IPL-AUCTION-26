import { AppError } from "@/lib/domain/errors";
import type { PlayerUploadRowInput } from "@/lib/domain/schemas";
import type { Room } from "@/lib/domain/types";
import { normalizePlayerRows } from "@/lib/domain/upload";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface InsertPlayersIntoRoomOptions {
  requireEmpty?: boolean;
}

export async function insertPlayersIntoRoom(
  room: Room,
  players: PlayerUploadRowInput[],
  options: InsertPlayersIntoRoomOptions = {},
) {
  const admin = getSupabaseAdminClient();
  const normalizedPlayers = normalizePlayerRows(players);

  if (normalizedPlayers.length === 0) {
    throw new AppError("No valid players were provided for import.", 400, "NO_PLAYERS");
  }

  const { data: auctionState, error: auctionError } = await admin
    .from("auction_state")
    .select("phase")
    .eq("room_id", room.id)
    .maybeSingle();

  if (auctionError) {
    throw new AppError(auctionError.message, 500, "AUCTION_FETCH_FAILED");
  }

  if (auctionState && auctionState.phase !== "WAITING") {
    throw new AppError(
      "Player uploads are locked once the auction has started.",
      400,
      "AUCTION_ALREADY_STARTED",
    );
  }

  if (options.requireEmpty) {
    const { count, error: countError } = await admin
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);

    if (countError) {
      throw new AppError(countError.message, 500, "PLAYER_COUNT_FAILED");
    }

    if ((count ?? 0) > 0) {
      throw new AppError(
        "This room already has players. Clear the current list before loading the default player pool.",
        400,
        "PLAYERS_ALREADY_PRESENT",
      );
    }
  }

  const { data: existingPlayers, error: existingPlayersError } = await admin
    .from("players")
    .select("order_index")
    .eq("room_id", room.id)
    .order("order_index", { ascending: false })
    .limit(1);

  if (existingPlayersError) {
    throw new AppError(existingPlayersError.message, 500, "PLAYER_FETCH_FAILED");
  }

  const startIndex = Number(existingPlayers?.[0]?.order_index ?? 0);
  const rows = normalizedPlayers.map((player, index) => ({
    room_id: room.id,
    name: player.name,
    role: player.role,
    nationality: player.nationality,
    // Spreadsheet updates may omit pricing; fall back to the room increment.
    base_price: player.basePrice > 0 ? player.basePrice : room.bidIncrement,
    status: "AVAILABLE",
    stats: player.stats,
    order_index: startIndex + index + 1,
    current_team_id: null,
    sold_price: null,
  }));

  const { error } = await admin.from("players").insert(rows);

  if (error) {
    throw new AppError(error.message, 500, "PLAYER_IMPORT_FAILED");
  }

  return {
    imported: rows.length,
  };
}
