/**
 * GET  /api/admin/settings  — return current feature flags
 * PATCH /api/admin/settings — update one or more feature flags
 *   Body: { user_score_fetch?: boolean }
 *
 * Superadmin only.
 */
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { handleRouteError } from "@/lib/server/api";
import { requireSuperAdmin } from "@/lib/server/auth";
import { getFeatureFlags, setFeatureFlag } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSuperAdmin();
    const flags = await getFeatureFlags();
    return NextResponse.json({ ok: true, flags });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireSuperAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if ("user_score_fetch" in body) {
      if (typeof body.user_score_fetch !== "boolean") {
        throw new AppError("user_score_fetch must be a boolean.", 400, "INVALID_INPUT");
      }
      await setFeatureFlag("user_score_fetch", body.user_score_fetch);
    }

    // Invalidate all results pages so the new flag is picked up immediately
    revalidatePath("/results", "layout");

    const flags = await getFeatureFlags();
    return NextResponse.json({ ok: true, flags });
  } catch (error) {
    return handleRouteError(error);
  }
}
