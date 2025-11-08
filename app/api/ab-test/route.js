export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/authOptions";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { DateTime } from "luxon";

export async function POST(req) {
  try {
    // ✅ REQUIRE AUTHENTICATED USER
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const userEmail = session.user.email;

    // ✅ PARSE REQUEST BODY
    const body = await req.json();
    console.log("📦 Received A/B Test request:", body);

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

    // ✅ NORMALIZE INPUT
    const normalizedVideoId = video_id || videoId;
    const thumbnails = thumbnail_urls || thumbnailUrls;

    if (!normalizedVideoId) {
      return NextResponse.json(
        { message: "Missing required field: videoId" },
        { status: 400 }
      );
    }

    if (!thumbnails || !Array.isArray(thumbnails) || thumbnails.length === 0) {
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

    // ✅ VALIDATE UTC TIMESTAMPS
    const startUTC = DateTime.fromISO(start_datetime, { zone: "utc" });
    const endUTC = DateTime.fromISO(end_datetime, { zone: "utc" });

    if (!startUTC.isValid || !endUTC.isValid) {
      return NextResponse.json(
        { message: "Invalid datetime format — must be ISO strings" },
        { status: 400 }
      );
    }

    if (endUTC <= startUTC) {
      return NextResponse.json(
        { message: "end_datetime must be AFTER start_datetime" },
        { status: 400 }
      );
    }

    // ✅ SUBSCRIPTION CHECK (IMPORTANT!)
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("user_email", userEmail)
      .maybeSingle();

    if (!subscription || subscription.status !== "active") {
      return NextResponse.json(
        {
          message:
            "You must have an active subscription to create rotation schedules.",
          subscription_required: true,
        },
        { status: 402 } // Payment Required
      );
    }

    // ✅ COMPUTE INITIAL NEXT-RUN TIME (start of the schedule)
    const nextRunUTC = startUTC.toISO();

    // ✅ INSERT MAIN A/B TEST ENTRY
    const { data: abTest, error: insertError } = await supabaseAdmin
      .from("ab_tests")
      .insert([
        {
          video_id: normalizedVideoId,
          thumbnail_urls: thumbnails,
          start_datetime: startUTC.toISO(),
          end_datetime: endUTC.toISO(),
          rotation_interval_value: rotation_interval_value || 1,
          rotation_interval_unit: rotation_interval_unit || "hours",
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
      console.error("❌ Error inserting A/B test:", insertError);
      throw insertError;
    }

    // ✅ INSERT THUMBNAIL METADATA (non-blocking)
    const metadataRows = thumbnails.map((url) => ({
      ab_test_id: abTest.id,
      video_id: normalizedVideoId,
      url,
      created_at: new Date().toISOString(),
    }));

    const { error: thumbError } = await supabaseAdmin
      .from("thumbnails_meta")
      .insert(metadataRows);

    if (thumbError) {
      console.error("⚠️ Failed to insert thumbnail metadata:", thumbError);
      // Not fatal — test still created
    }

    // ✅ SUCCESS RESPONSE
    return NextResponse.json(
      {
        success: true,
        test_id: abTest.id,
        message: "Thumbnail Rotation Schedule created successfully!",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Server error in /api/ab-test:", err);
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
