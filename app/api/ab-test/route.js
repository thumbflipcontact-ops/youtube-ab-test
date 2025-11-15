export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/authOptions";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { DateTime } from "luxon";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email;
    const body = await req.json();

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

    // Normalize fields
    const normalizedVideoId = video_id || videoId;
    const thumbnails = thumbnail_urls || thumbnailUrls;

    if (!normalizedVideoId) {
      return NextResponse.json({ message: "Missing required field: videoId" }, { status: 400 });
    }

    if (!thumbnails || thumbnails.length === 0) {
      return NextResponse.json({ message: "At least one thumbnail required" }, { status: 400 });
    }

    if (!start_datetime || !end_datetime) {
      return NextResponse.json({ message: "start_datetime and end_datetime are required" }, { status: 400 });
    }

    /**
     * FIXED HERE:
     * Treat input ISO as UTC and DO NOT offset again.
     */
    const startUTC = DateTime.fromISO(start_datetime).toUTC();
    const endUTC = DateTime.fromISO(end_datetime).toUTC();

    if (!startUTC.isValid || !endUTC.isValid) {
      return NextResponse.json({ message: "Invalid datetime format" }, { status: 400 });
    }

    if (endUTC <= startUTC) {
      return NextResponse.json({ message: "end_datetime must be AFTER start_datetime" }, { status: 400 });
    }

    // Initial next run
    const nextRunUTC = startUTC.toISO();

    // Insert test
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

console.log("📥 RAW start_datetime:", start_datetime);
console.log("📥 RAW end_datetime:", end_datetime);

    if (insertError) throw insertError;

    // Insert thumbnail metadata
    const metadataRows = thumbnails.map((url) => ({
      ab_test_id: abTest.id,
      video_id: normalizedVideoId,
      url,
      created_at: DateTime.utc().toISO(),
    }));

    await supabaseAdmin.from("thumbnails_meta").insert(metadataRows);

    return NextResponse.json(
      {
        success: true,
        test_id: abTest.id,
        message: "A/B Test created successfully!",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Error in /api/ab-test:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
