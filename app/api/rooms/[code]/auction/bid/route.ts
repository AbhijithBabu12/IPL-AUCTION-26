import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { bidSchema } from "@/lib/domain/schemas";
import { readJson, handleRouteError } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const startedAt = Date.now();
  const marks: Array<{ step: string; ms: number }> = [];
  const mark = (step: string) => {
    marks.push({ step, ms: Date.now() - startedAt });
  };
  try {
    const { code } = await context.params;
    mark("params");
    const authUser = await requireApiUser();
    mark("requireApiUser");
    const input = await readJson(request, bidSchema);
    mark("readJson");
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("place_auction_bid", {
      p_room_code: code,
      p_user_id: authUser.id,
      p_team_id: input.teamId,
      p_increment: input.increment ?? null,
    });
    mark("placeAuctionBidRpc");

    if (error) {
      throw new AppError(error.message || "Bid failed.", 400, "BID_RPC_FAILED");
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      throw new AppError("Bid failed.", 500, "BID_RPC_EMPTY");
    }

    const timing = {
      totalMs: Date.now() - startedAt,
      steps: marks,
    };
    console.info("[auction-bid-timing]", JSON.stringify({ roomCode: code.toUpperCase(), timing }));
    return NextResponse.json(
      { amount: Number(result.amount), timing },
      {
        headers: {
          "x-auction-bid-ms": String(timing.totalMs),
        },
      },
    );
  } catch (error) {
    console.error("[auction-bid-error-timing]", JSON.stringify({
      totalMs: Date.now() - startedAt,
      steps: marks,
      message: error instanceof Error ? error.message : String(error),
    }));
    return handleRouteError(error);
  }
}
