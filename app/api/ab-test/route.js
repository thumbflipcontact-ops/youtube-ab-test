// app/api/ab-test/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/authOptions";   // ✅ UPDATED IMPORT
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(req) {
  try {
    // ✅ Require logged-in user
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      console.warn("⚠️ Unauthorized request to /api/ab-test");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email;
    const nextRunUTC = DateTime.fromISO(start_datetime).toUTC().toISO();

    // ✅ Parse JSON body
    const body = await req.json();

    const {
      video_id,
      videoId,
      thumbnail_urls,
      thumbnailUrls,
      start_datetime,
      end_datetime,
      title,
      description,
      access_token,
      rotation_interval_value,
      rotation_interval_unit,
    } = body;

    // ✅ normalize video & thumbnail inputs
    const normalizedVideoId = video_id || videoId;
    const normalizedThumbnails = thumbnail_urls || thumbnailUrls;

    console.log("📦 Received body:", body);

    // ✅ Required field validation
    if (!normalizedVideoId) {
      return NextResponse.json(
        { message: "Missing videoId" },
        { status: 400 }
      );
    }

    if (!normalizedThumbnails?.length) {
      return NextResponse.json(
        { message: "thumbnailUrls is required and must be an array" },
        { status: 400 }
      );
    }

    if (!start_datetime || !end_datetime) {
      return NextResponse.json(
        { message: "start_datetime and end_datetime are required" },
        { status: 400 }
      );
    }

    // ✅ Validate UTC timestamps
    const startUTC = new Date(start_datetime);
    const endUTC = new Date(end_datetime);

    if (isNaN(startUTC.getTime()) || isNaN(endUTC.getTime())) {
      return NextResponse.json(
        { message: "Invalid date format. start_datetime & end_datetime must be valid ISO UTC strings." },
        { status: 400 }
      );
    }

    if (endUTC <= startUTC) {
      return NextResponse.json(
        { message: "end_datetime must be AFTER start_datetime" },
        { status: 400 }
      );
    }

    // ✅ Insert AB Test record
    const { data: abTest, error: insertError } = await supabaseAdmin
      .from("ab_tests")
      .insert([
        {
          video_id: normalizedVideoId,
          thumbnail_urls: normalizedThumbnails,
          start_datetime: start_datetime, // already UTC from frontend
          end_datetime: end_datetime,     // already UTC from frontend
          access_token: access_token || null,
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

    console.log(`✅ A/B Test created: ${abTest.id}`);

    // ✅ Insert metadata for each thumbnail
    const inserts = normalizedThumbnails.map((url) => ({
      video_id: normalizedVideoId,
      url,
      ab_test_id: abTest.id,
      created_at: new Date().toISOString(),
    }));

    const { error: thumbError } = await supabaseAdmin
      .from("thumbnails_meta")
      .insert(inserts);

    if (thumbError) {
      console.error("⚠️ Failed to insert thumbnail metadata:", thumbError);
    } else {
      console.log(`🖼️ Inserted ${inserts.length} thumbnail metadata rows`);
    }

    return NextResponse.json(
      {
        success: true,
        test: abTest,
        thumbnailsInserted: inserts.length,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Error in /api/ab-test:", err);
    return NextResponse.json(
      { message: err.message, error: String(err) },
      { status: 500 }
    );
  }
}
