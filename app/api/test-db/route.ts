import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const start = Date.now();
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.from("rooms").select("id").limit(1);
    const duration = (Date.now() - start) + "ms";

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, duration }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data, duration });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message, name: err.name, cause: err.cause }, { status: 500 });
  }
}
