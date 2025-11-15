// app/api/my-tests/route.js

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/authOptions";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// ✅ FINAL GET — Only ONE
export async function GET() {
  try {
    // ✅ Authenticate user (App Router)
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;

    // ✅ Use service-role client (bypasses RLS safely)
    const { data, error } = await supabaseAdmin
      .from("ab_tests")
      .select("id, video_id, start_datetime, end_datetime, analytics_collected")
      .eq("user_email", userEmail)
      .order("id", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    console.error("❌ Failed to fetch user tests:", err);
    return NextResponse.json(
      { message: err.message },
      { status: 500 }
    );
  }
}
