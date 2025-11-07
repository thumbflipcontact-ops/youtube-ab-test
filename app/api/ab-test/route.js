// app/api/ab-test/route.js
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/authOptions";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { DateTime } from "luxon";

export async function POST(req) {
  try {
    // ✅ Require logged in user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const userEmail = session.user.email;

    // ✅ Parse body AFTER session
    const body = await req.json();
    console.log("📦 Received A/B test body:", body);

    const {
      video_id,
      videoId,
      thumbnail_urls,
      thumbnailUrls,
      start_datetime,
      end_datetime,
      rotation_interval_value,
      rotation_interval_unit,
    } = body;

    // ✅ Normalize input fields
    const normalizedVideoId = video_id || videoId;
    const thumbnails = thumbnail_urls || thumbnailUrls;

    if (!normalizedVideoId) {
      return NextResponse.json({ message: "Missing videoId" }, { status: 400 });
    }
    if (!thumbnails?.length) {
      return NextResponse.json(
        { message: "thumbnailUrls must contain at least 1 image" },
        { status: 400 }
      );
    }
    if (!start_datetime || !end_datetime) {
      return NextResponse.json(
        { message: "start_datetime and end_datetime are required" },
        { status: 400 }
      );
    }

    // ✅ Validate the timestamps
    const startUTC = DateTime.fromISO(start_datetime, { zone: "utc" });
    const endUTC = DateTime.fromISO(end_datetime, { zone: "utc" });

    if (!startUTC.isValid || !endUTC.isValid) {
      return NextResponse.json(
        { message: "Invalid datetime format — must be ISO UTC" },
        { status: 400 }
      );
    }
    if (endUTC <= startUTC) {
      return NextResponse.json(
        { message: "end_datetime must be AFTER start_datetime" },
        { status: 400 }
      );
    }

    // ✅ Compute NEXT RUN TIME
    const nextRunUTC = startUTC.toISO(); // Cron will rotate at start time

    // ✅ Insert into A/B tests
    const { data: abTest, error: insertError } = await supabaseAdmin
      .from("ab_tests")
      .insert([
        {
          video_id: normalizedVideoId,
          thumbnail_urls: thumbnails,
          start_datetime: startUTC.toISO(),
          end_datetime: endUTC.toISO(),
          rotation_interval_value: rotation_interval_value || 15,
          rotation_interval_unit: rotation_interval_unit || "minutes",
          current_index: 0,
          last_rotation_time: null,
          next_run_time: nextRunUTC,
          analytics_collected: false,
          user_email: userEmail,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("❌ Supabase insert error:", insertError);
      throw insertError;
    }

    // ✅ Insert thumbnails into metadata
    const thumbRows = thumbnails.map((url) => ({
      ab_test_id: abTest.id,
      video_id: normalizedVideoId,
      url,
      created_at: new Date().toISOString(),
    }));

    const { error: thumbError } = await supabaseAdmin
      .from("thumbnails_meta")
      .insert(thumbRows);

    if (thumbError) {
      console.error("⚠️ Metadata insert failed:", thumbError);
    }

    return NextResponse.json(
      {
        success: true,
        test_id: abTest.id,
        message: "A/B Test created successfully",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Error in /api/ab-test:", err);
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
