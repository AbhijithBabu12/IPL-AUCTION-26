/**
 * /admin — Global Admin Panel
 *
 * Hidden from all navigation. Accessible only by typing /admin in the URL.
 * Requires users.is_superadmin = true; otherwise renders a plain 403 page.
 */

import { redirect } from "next/navigation";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/server/auth";
import { hasServiceRoleEnv } from "@/lib/config";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Supabase must be configured for this page to function
  if (!hasServiceRoleEnv) {
    return (
      <main style={{ padding: "3rem", fontFamily: "var(--font-body, system-ui)" }}>
        <h1>503 — Service Not Ready</h1>
        <p>The server is not fully configured.</p>
      </main>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Check superadmin status
  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("is_superadmin, display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_superadmin) {
    return (
      <main style={{ padding: "3rem", fontFamily: "var(--font-body, system-ui)", color: "var(--fg, #fff)" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>403</h1>
        <p style={{ color: "var(--subtle, #888)" }}>You do not have access to this page.</p>
      </main>
    );
  }

  return (
    <AdminShell
      adminName={(profile.display_name as string | null) ?? (profile.email as string | null) ?? "Admin"}
    />
  );
}
