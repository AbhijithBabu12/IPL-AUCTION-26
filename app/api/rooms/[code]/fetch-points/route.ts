/**
 * POST /api/rooms/[code]/fetch-points
 *
 * Room member (when user_score_fetch flag is ON) or room admin (always).
 * Re-aggregates all accepted match_results and rebuilds players.stats.
 * Read-only relative to match_results — safe for members to call.
 *
 * Superadmin can disable member access via the feature_flags toggle.
 */
import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { handleRouteError } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { requireRoomMember } from "@/lib/server/room";
import { recalculateRoomStats } from "@/lib/server/score-push";
import { getFeatureFlags } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const authUser = await requireApiUser();
    const { room, member } = await requireRoomMember(code, authUser.id);

    // Non-admins require the feature flag to be enabled
    if (!member.isAdmin) {
      const flags = await getFeatureFlags();
      if (!flags.user_score_fetch) {
        throw new AppError(
          "Score updates are currently managed by the admin.",
          403,
          "FEATURE_DISABLED",
        );
      }
    }

    const result = await recalculateRoomStats(room.id, room.code);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
