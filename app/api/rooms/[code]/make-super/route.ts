/**
 * /api/rooms/[code]/make-super — REMOVED
 * The super room concept has been removed. All rooms have equal access to all features.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({ ok: false, error: "Super room concept removed." }, { status: 410 });
}
