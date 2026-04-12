"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasServiceRoleEnv } from "@/lib/config";

export async function updateDisplayNameAction(formData: FormData) {
  const user = await requireSessionUser();

  const raw = formData.get("displayName");
  const displayName =
    typeof raw === "string" ? raw.trim() : "";

  if (!displayName || displayName.length < 2) {
    redirect("/profile?error=name_too_short");
  }

  if (displayName.length > 40) {
    redirect("/profile?error=name_too_long");
  }

  if (hasServiceRoleEnv) {
    const admin = getSupabaseAdminClient();
    await admin
      .from("users")
      .update({ display_name: displayName })
      .eq("id", user.id);
  }

  // Also update Supabase Auth user_metadata so mapAuthUser stays in sync
  const supabase = await createSupabaseServerClient();
  await supabase.auth.updateUser({
    data: { full_name: displayName, name: displayName, user_name: displayName },
  });

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  redirect("/profile?notice=name_updated");
}
