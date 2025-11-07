// app/api/ab-test/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(req) {
  try {
    // 🔒 Authentication (App Router version)
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      console.warn("⚠️ Unauthorized access attempt to /api/ab-test");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email;

    // 🔄 Parse incoming JSON
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

    const normalizedVideoId = video_id || videoId;
    const normalizedThumbnails = thumbnail_urls || thumbnailUrls;

    console.log("📦 Received body:", body);

    // ✅ Validation
    if (
      !normalizedVideoId ||
      !normalizedThumbnails?.length ||
      !start_datetime ||
      !end_datetime
    ) {
      return NextResponse.json(
        {
          message:
            "Missing required fields: video_id, thumbnail_urls, start_datetime, end_datetime",
          received: body,
        },
        { status: 400 }
      );
    }

    // ✅ 1️⃣ Insert A/B test entry
    const { data: abTest, error: insertError } = await supabaseAdmin
      .from("ab_tests")
      .insert([
        {
          video_id: normalizedVideoId,
          thumbnail_urls: normalizedThumbnails,
          start_datetime,
          end_datetime,
          access_token: access_token || null,
          rotation_interval_value: rotation_interval_value || 15,
          rotation_interval_unit: rotation_interval_unit || "minutes",
          current_index: 0,
          last_rotation_time: null,
          analytics_collected: false,
          user_email: userEmail,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    console.log(`✅ A/B Test created successfully for ${userEmail}:`, abTest.id);

    // ✅ 2️⃣ Insert thumbnail metadata entries
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
      console.error(
        "⚠️ Failed to insert some thumbnails_meta:",
        thumbError.message
      );
    } else {
      console.log(`🖼️ Inserted ${inserts.length} thumbnail_meta rows`);
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
    console.error("❌ Failed to create A/B test:", err);
    return NextResponse.json(
      { message: err.message, full: String(err) },
      { status: 500 }
    );
  }
}
