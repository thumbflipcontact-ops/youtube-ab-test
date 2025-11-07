// app/api/analytics/route.js

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/authOptions";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// ✅ GET analytics results for a specific test
export async function GET(req) {
  try {
    // ✅ Authenticate user
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      console.warn("⚠️ Unauthorized request to /api/analytics");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email;

    // ✅ Extract testId from URL query
    const { searchParams } = new URL(req.url);
    const testId = searchParams.get("testId");

    if (!testId) {
      return NextResponse.json(
        { message: "Missing required parameter: testId" },
        { status: 400 }
      );
    }

    // ✅ Fetch analytics from Supabase
    const { data, error } = await supabaseAdmin
      .from("thumbnail_performance")
      .select(`
        id,
        ab_test_id,
        video_id,
        thumbnail_url,
        views,
        estimated_minutes_watched,
        average_view_duration,
        likes,
        comments,
        collected_at
      `)
      .eq("user_email", userEmail)
      .eq("ab_test_id", testId)
      .order("collected_at", { ascending: false });

    if (error) {
      console.error("❌ Supabase error:", error);
      throw error;
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    console.error("❌ Error fetching analytics:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch analytics data",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
