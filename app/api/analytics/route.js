// app/api/analytics/route.js

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/authOptions";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { DateTime } from "luxon";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const testId = searchParams.get("testId");

  if (!testId) {
    return NextResponse.json({ message: "Missing testId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("thumbnail_performance")
    .select("*")
    .eq("ab_test_id", testId);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
