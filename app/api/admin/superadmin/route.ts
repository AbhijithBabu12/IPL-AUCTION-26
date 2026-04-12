/**
 * POST /api/admin/superadmin
 *
 * Grant or revoke superadmin access by email.
 * Body: { email: string, grant: boolean }
 */

import { NextResponse } from "next/server";

import { AppError } from "@/lib/domain/errors";
import { handleRouteError } from "@/lib/server/api";
import { requireSuperAdmin } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const admin = getSupabaseAdminClient();

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const grant = body.grant !== false; // default true

    if (!email) throw new AppError("email is required.", 400, "NO_DATA");

    const { data: user, error: findError } = await admin
      .from("users")
      .select("id, email, display_name")
      .eq("email", email)
      .maybeSingle();

    if (findError) throw new AppError(findError.message, 500, "DB_QUERY_FAILED");
    if (!user) throw new AppError(`No user found with email: ${email}`, 404, "NOT_FOUND");

    const { error: updateError } = await admin
      .from("users")
      .update({ is_superadmin: grant })
      .eq("id", user.id as string);

    if (updateError) throw new AppError(updateError.message, 500, "DB_QUERY_FAILED");

    return NextResponse.json({
      ok: true,
      message: `${grant ? "Granted" : "Revoked"} superadmin for ${email}.`,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from("users")
      .select("id, email, display_name")
      .eq("is_superadmin", true);

    if (error) throw new AppError(error.message, 500, "DB_QUERY_FAILED");

    return NextResponse.json({ ok: true, superadmins: data ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}
