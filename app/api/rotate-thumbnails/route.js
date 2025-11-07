// app/api/rotate-thumbnails/route.js
import { NextResponse } from "next/server";
import axios from "axios";
import { DateTime } from "luxon";
import { supabase } from "../../../lib/supabase";
import { getYouTubeClientForUserByEmail } from "../../../lib/youtubeClient";

const CRON_SECRET = process.env.CRON_SECRET; // ✅ set this in Vercel & cron-job.org

export async function GET(req) {
  // ✅ 1. Security check
  const headerSecret = req.headers.get("x-cron-secret");
  if (!headerSecret || headerSecret !== CRON_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("⏱️ Cron triggered → Checking tests...");

    // ✅ 2. Get current UTC time
    const nowUTC = DateTime.now().toUTC().toISO();

    // ✅ 3. Fetch tests that need rotation
    const { data: tests, error } = await supabase
      .from("ab_tests")
      .select("*")
      .lte("next_run_time", nowUTC)
      .eq("analytics_collected", false);

    if (error) {
      console.error("❌ DB Error:", error);
      return NextResponse.json({ message: "DB error" }, { status: 500 });
    }

    if (!tests || tests.length === 0) {
      console.log("✅ No tests due for rotation.");
      return NextResponse.json({ rotated: 0 });
    }

    console.log(`🔍 Found ${tests.length} tests requiring rotation.`);

    let rotatedCount = 0;

    // ✅ 4. Process each test
    for (const test of tests) {
      const {
        id,
        video_id,
        thumbnail_urls,
        current_index,
        rotation_interval_value,
        rotation_interval_unit,
        user_email,
      } = test;

      if (!thumbnail_urls || thumbnail_urls.length === 0) {
        console.warn(`⚠️ No thumbnails for test ${id}`);
        continue;
      }

      // ✅ Pick next thumbnail
      const nextIndex = (current_index + 1) % thumbnail_urls.length;
      const nextThumbnail = thumbnail_urls[nextIndex];

      console.log(`🔄 Rotating video ${video_id} → ${nextThumbnail}`);

      // ✅ Get authenticated YouTube client
      const { youtube } = await getYouTubeClientForUserByEmail(user_email);

      // ✅ Download thumbnail as buffer
      const imageResp = await axios.get(nextThumbnail, {
        responseType: "arraybuffer",
      });

      // ✅ Upload new thumbnail
      await youtube.thumbnails.set({
        videoId: video_id,
        media: {
          mimeType: "image/jpeg",
          body: Buffer.from(imageResp.data),
        },
      });

      // ✅ Compute next rotation time
      let nextTime = DateTime.now().toUTC();
      nextTime = nextTime.plus({ [rotation_interval_unit]: rotation_interval_value });

      // ✅ Update DB state
      await supabase
        .from("ab_tests")
        .update({
          current_index: nextIndex,
          last_rotation_time: DateTime.now().toUTC().toISO(),
          next_run_time: nextTime.toISO(),
        })
        .eq("id", id);

      console.log(`✅ Test ${id} rotated successfully.`);

      rotatedCount++;
    }

    return NextResponse.json({ success: true, rotated: rotatedCount });
  } catch (err) {
    console.error("❌
