// app/api/rotate-thumbnails/route.js
import { NextResponse } from "next/server";
import axios from "axios";
import { DateTime } from "luxon";
import { supabase } from "../../../lib/supabase";
import { getYouTubeClientForUserByEmail } from "../../../lib/youtubeClient";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req) {
  const headerSecret = req.headers.get("x-cron-secret");
  if (!headerSecret || headerSecret !== CRON_SECRET) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    console.log("Cron triggered. Checking tests...");

    const nowUTC = DateTime.now().toUTC().toISO();

    const { data: tests, error } = await supabase
      .from("ab_tests")
      .select("*")
      .lte("next_run_time", nowUTC)
      .eq("analytics_collected", false);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { message: "Database error" },
        { status: 500 }
      );
    }

    if (!tests || tests.length === 0) {
      console.log("No tests due for rotation.");
      return NextResponse.json({ rotated: 0 });
    }

    let rotatedCount = 0;

    for (const test of tests) {
      const {
        id,
        video_id,
        thumbnail_urls,
        current_index,
        rotation_interval_value,
        rotation_interval_unit,
        user_email
      } = test;

      if (!thumbnail_urls || thumbnail_urls.length === 0) {
        console.warn("Skipping test " + id + ": no thumbnails.");
        continue;
      }

      const nextIndex = (current_index + 1) % thumbnail_urls.length;
      const nextThumbnail = thumbnail_urls[nextIndex];

      console.log("Rotating video " + video_id + " to " + nextThumbnail);

      const { youtube } = await getYouTubeClientForUserByEmail(user_email);

      const imageResp = await axios.get(nextThumbnail, {
        responseType: "arraybuffer"
      });

      await youtube.thumbnails.set({
        videoId: video_id,
        media: {
          mimeType: "image/jpeg",
          body: Buffer.from(imageResp.data)
        }
      });

      let nextTime = DateTime.now().toUTC();
      nextTime = nextTime.plus({
        [rotation_interval_unit]: rotation_interval_value
      });

      await supabase
        .from("ab_tests")
        .update({
          current_index: nextIndex,
          last_rotation_time: DateTime.now().toUTC().toISO(),
          next_run_time: nextTime.toISO()
        })
        .eq("id", id);

      rotatedCount++;
      console.log("Rotation completed for test " + id);
    }

    return NextResponse.json(
      { success: true, rotated: rotatedCount },
      { status: 200 }
    );
  } catch (err) {
    console.error("Rotation error:", err.message);
    return NextResponse.json(
      { message: err.message },
      { status: 500 }
    );
  }
}
