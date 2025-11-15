// =============================================================
//  rotate-thumbnails/route.js  — Rotate ALL due tests
// =============================================================
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import axios from "axios";
import { DateTime } from "luxon";
import { supabase } from "../../../lib/supabase";
import { getYouTubeClientForUserByEmail } from "../../../lib/youtubeClient";

const CRON_SECRET = (process.env.CRON_SECRET || "").trim().toLowerCase();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadThumbnailSafe(youtube, videoId, imageBuffer) {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await youtube.thumbnails.set({
        videoId,
        media: {
          mimeType: "image/jpeg",
          body: imageBuffer,
        },
      });
      return { ok: true };
    } catch (err) {
      if (err.code === 429) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      return { ok: false, fatal: true, error: err.message };
    }
  }

  return { ok: false, fatal: false, reason: "rate-limit" };
}

// === Check if test has ended (but do NOT touch analytics_collected here)
function testHasEnded(test) {
  if (!test.end_datetime) return false;
  const end = DateTime.fromISO(test.end_datetime).toUTC();
  return end <= DateTime.now().toUTC();
}

export async function GET(req) {
  // === Check Cron Secret
  const headerSecret = (req.headers.get("x-cron-secret") || "")
    .trim()
    .toLowerCase();

  if (!headerSecret || headerSecret !== CRON_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("🚀 CRON RUNNING — checking tests due for rotation…");

    const nowUTC = DateTime.now().toUTC().toISO();

    // =============================================================
    //  Fetch ALL due tests — NO PER-USER LIMIT NOW
    // =============================================================
    const { data: tests, error } = await supabase
      .from("ab_tests")
      .select("*")
      .lte("next_run_time", nowUTC)
      .eq("analytics_collected", false); // analytics will run later by separate cron

    if (error) {
      console.error("❌ DB read error:", error);
      return NextResponse.json({ message: "Database error" }, { status: 500 });
    }

    if (!tests || tests.length === 0) {
      console.log("ℹ️ No tests due.");
      return NextResponse.json({ success: true, rotated: 0 });
    }

    let totalRotations = 0;

    // =============================================================
    //  Rotate ALL due tests (NO LIMIT)
    // =============================================================
    for (const test of tests) {
      const {
        id,
        video_id,
        thumbnail_urls,
        current_index,
        rotation_interval_unit,
        rotation_interval_value,
        user_email,
      } = test;

      if (!thumbnail_urls || thumbnail_urls.length === 0) {
        console.warn(`⚠️ Test ${id}: No thumbnails, skipping.`);
        continue;
      }

      // Skip ended tests
      if (testHasEnded(test)) {
        console.log(`⏹ Test ${id} has ended, skipping.`);
        continue;
      }

      const nextIndex = (current_index + 1) % thumbnail_urls.length;
      const nextThumbnail = thumbnail_urls[nextIndex];

      console.log(`🔄 Rotating Test ${id}, Video ${video_id}`);

      const { youtube } = await getYouTubeClientForUserByEmail(user_email);

      const img = await axios.get(nextThumbnail, {
        responseType: "arraybuffer",
      });

      const uploadResult = await uploadThumbnailSafe(
        youtube,
        video_id,
        Buffer.from(img.data)
      );

      if (!uploadResult.ok) {
        console.warn(`⚠️ Rotation failed for test ${id}.`);
        continue;
      }

      const nextTime = DateTime.now()
        .toUTC()
        .plus({ [rotation_interval_unit]: rotation_interval_value })
        .startOf("second")
        .toISO();

      const updateErr = await supabase
        .from("ab_tests")
        .update({
          current_index: nextIndex,
          last_rotation_time: DateTime.now().toUTC().startOf("second").toISO(),
          next_run_time: nextTime,
        })
        .eq("id", id);

      if (updateErr.error) {
        console.error(`❌ Failed updating test ${id}`, updateErr.error);
        continue;
      }

      totalRotations++;

      await sleep(400);
    }

    return NextResponse.json(
      {
        success: true,
        rotated: totalRotations,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("🔥 Unexpected Cron Error:", err);
    return NextResponse.json(
      { message: "Server error logged", error: err.message },
      { status: 200 }
    );
  }
}
