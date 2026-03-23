import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const USERS = [
  { email: "sherlockholmes221b715@gmail.com", name: "Wayanad Tarzans" },
  { email: "abhijithbabu855@gmail.com",       name: "OPM" },
  { email: "sonushajim@gmail.com",            name: "Malabar Magic" },
  { email: "lonewolf6996a@gmail.com",         name: "Kerala Indians" },
  { email: "abiddileep7@gmail.com",           name: "Mumbai Indians" },
  { email: "gpy120643@gmail.com",             name: "Goated Super Kings" },
  { email: "swabeehca@gmail.com",             name: "Kerala Blasters" },
];

// One-time seeding endpoint — DELETE THIS ROUTE after running once.
export async function POST() {
  const admin = getSupabaseAdminClient();
  const results: { email: string; status: string }[] = [];

  for (const user of USERS) {
    const { error } = await admin.auth.admin.createUser({
      email: user.email,
      password: "12345678",
      email_confirm: true,
      user_metadata: { full_name: user.name },
    });

    results.push({
      email: user.email,
      status: error ? `error: ${error.message}` : "created",
    });
  }

  return NextResponse.json({ results });
}
