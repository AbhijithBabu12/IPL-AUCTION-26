import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

import { asAppError } from "@/lib/domain/errors";

export async function readJson<T>(request: Request, schema: ZodSchema<T>) {
  const body = await request.json();
  return schema.parse(body);
}

/**
 * Map error code + HTTP status to a user-facing message.
 * Keep these generic enough that they never leak internal details.
 * The raw technical message is preserved in `detail` (visible in Network → Preview).
 */
function toClientMessage(status: number, code: string, originalMessage: string): string {
  // Messages that are already safe and user-friendly — pass through as-is
  const safePassthrough = new Set([
    "UNAUTHORIZED",
    "ADMIN_REQUIRED",
    "ROOM_ACCESS_DENIED",
    "TEAM_ACCESS_DENIED",
    "FORBIDDEN",
    "ROOM_NOT_FOUND",
    "PLAYER_NOT_FOUND",
    "TEAM_NOT_FOUND",
    "NOT_FOUND",
    "VERSION_CONFLICT",
    "INVALID_PHASE",
    "DUPLICATE_BID",
    "TIMER_EXPIRED",
    "LOW_PURSE",
    "NO_PLAYER",
    "NO_ACTIVE_PLAYER",
    "NO_PLAYERS",
    "NO_TEAMS",
    "NO_FILE",
    "NO_DATA",
    "INVALID_INCREMENT",
    "SQUAD_FULL",
    "INSUFFICIENT_PURSE",
    "AUCTION_ALREADY_STARTED",
  ]);

  if (safePassthrough.has(code)) {
    return originalMessage;
  }

  // Technical codes — replace with friendly messages
  if (status === 401) return "You need to be signed in to do this.";
  if (status === 403) return "You don't have permission to perform this action.";
  if (status === 404) return "The item you were looking for could not be found.";
  if (status === 409) return "A conflict occurred. Refresh the page and try again.";

  if (code === "ROOM_CREATE_FAILED" || code === "ROOM_CODE_FAILED")
    return "Room could not be created. Please try again.";
  if (code === "ROOM_MEMBER_FAILED")
    return "Could not add you to the room. Please try again.";
  if (code === "AUCTION_INIT_FAILED")
    return "Auction setup failed. Please try again.";
  if (code === "BID_RPC_EMPTY")
    return "Bid could not be placed. Please try again.";
  if (code === "MISSING_SUPABASE_ENV")
    return "The server is not fully configured yet.";
  if (code === "UNEXPECTED_ERROR")
    return "Something went wrong. Please try again.";

  if (status >= 500)
    return "A server error occurred. Please try again shortly.";

  return "Something went wrong. Please try again.";
}

export function handleRouteError(error: unknown) {
  const appError = asAppError(error);

  const clientMessage = toClientMessage(appError.status, appError.code, appError.message);

  return NextResponse.json(
    {
      // Friendly message shown in the UI
      error: clientMessage,
      // Technical details — visible in Network → Preview but not rendered in the UI
      detail: appError.message !== clientMessage ? appError.message : undefined,
      code: appError.code,
    },
    {
      status: appError.status,
    },
  );
}
