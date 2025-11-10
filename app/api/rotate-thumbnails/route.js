// ✅ Must be at the top
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import axios from "axios";
import { DateTime } from "luxon";
import { supabase } from "../../../lib/supabase";
import { getYouTubeClientForUserByEmail } from "../../../lib/youtubeClient";

// ✅ Normalize secret (remove spaces, force lowercase)
const CRON_SECRET = (process.env.CRON_SECRET || "").trim().toLowerCase();

/* --------------------------------------------------------------
   ✅ Helper: Sleep utility for spacing YouTube API calls
-------------------------------------------------------------- */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* --------------------------------------------------------------
   ✅ Helper: Upload thumbnail with retries + rate-limit handling
-------------------------------------------------------------- */
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

      return { ok: true }; // Success ✅
    } catch (err) {
      // ✅ YouTube rate limit
      if (err.code === 429) {
        console.warn(
          `⚠️ Rate limit for ${videoId}. Retrying (${attempt + 1}/${MAX_RETRIES})`
        );
        await sleep(1500 * (attempt + 1));
        continue;
      }

      // ✅ Fatal YouTube error
      console.error("❌ Fatal thumbnail upload error:", err);
      return { ok: false, fatal: true, error: err.message };
    }
  }

  // ✅ 429 exhausted
  return { ok: false, fatal: false, reason: "rate-limit" };
}

/* --------------------------------------------------------------
   ✅ Helper: Check if test has ended
-------------------------------------------------------------- */
function testHasEnded(test) {
  // ✅ Analytics have been collected → test fully finished
  if (test.analytics_collected) return true;

  // ✅ end_datetime has passed
  if (test.end_datetime) {
    const end = DateTime.fromISO(test.end_datetime);
    if (end < DateTime.now().toUTC()) return true;
  }

  return false;
}

export async function GET(req) {
  // ✅ Validate cron secret
  const headerSecret = (req.headers.get("x-cron-secret") || "")
    .trim()
    .toLowerCase();

  if (!headerSecret || headerSecret !== CRON_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("✅ Cron triggered. Fetching due tests...");

    const nowUTC = DateTime.now().toUTC().toISO();

    // ✅ Fetch tests whose next_run_time <= now AND not analytics_collected
    const { data: tests, error } = await supabase
      .from("ab_tests")
      .select("*")
      .lte("next_run_time", nowUTC)
      .eq("analytics_collected", false);

    if (error) {
      console.error("❌ Database error:", error);
      return NextResponse.json({ message: "Database error" }, { status: 500 });
    }

    if (!tests || tests.length === 0) {
      console.log("ℹ️ No tests due for rotation.");
      return NextResponse.json({ rotated: 0 });
    }

    /* --------------------------------------------------------------
       ✅ Group tests per user
       We will rotate ONLY ONE TEST per user per cron run
    -------------------------------------------------------------- */
    const testsByUser = {};
    for (const test of tests) {
      if (!testsByUser[test.user_email]) testsByUser[test.user_email] = [];
      testsByUser[test.user_email].push(test);
    }

    let totalRotations = 0;

    /* --------------------------------------------------------------
       ✅ For each user → rotate ONE test
    -------------------------------------------------------------- */
    for (const userEmail of Object.keys(testsByUser)) {
      let userTests = testsByUser[userEmail];

      // ✅ Sort by next_run_time so oldest rotations go first
      userTests.sort(
        (a, b) =>
          new Date(a.next_run_time || 0) - new Date(b.next_run_time || 0)
      );

      const test = userTests[0]; // rotate one per user

      const {
        id,
        video_id,
        thumbnail_urls,
        current_index,
        rotation_interval_unit,
        rotation_interval_value,
        end_datetime,
      } = test;

      // ✅ Skip invalid thumbnails
      if (!thumbnail_urls || thumbnail_urls.length === 0) {
        console.warn(`Skipping test ${id}: no thumbnails.`);
        continue;
      }

      // ✅ Skip ended tests (IMPORTANT!)
      if (testHasEnded(test)) {
        console.log(`⏹️ Test ${id} has ended. Skipping rotation and DB update.`);
        continue;
      }

      // ✅ Prepare next thumbnail
      const nextIndex = (current_index + 1) % thumbnail_urls.length;
      const nextThumbnail = thumbnail_urls[nextIndex];

      console.log(`🔄 Rotating video ${video_id} → ${nextThumbnail}`);

      // ✅ Get YouTube API client
      const { youtube } = await getYouTubeClientForUserByEmail(userEmail);

      // ✅ Fetch image
      const img = await axios.get(nextThumbnail, {
        responseType: "arraybuffer",
      });

      // ✅ Upload thumbnail safely
      const uploadResult = await uploadThumbnailSafe(
        youtube,
        video_id,
        Buffer.from(img.data)
      );

      if (!uploadResult.ok) {
        console.warn(`⚠️ Skipping rotation for ${video_id}. Reason:`, uploadResult.reason || uploadResult.error);
        continue; // Do not fail cron
      }

      // ✅ Only update DB for ACTIVE tests
      const nextTime = DateTime.now()
        .toUTC()
        .plus({ [rotation_interval_unit]: rotation_interval_value });

      await supabase
        .from("ab_tests")
        .update({
          current_index: nextIndex,
          last_rotation_time: DateTime.now().toUTC().toISO(),
          next_run_time: nextTime.toISO(),
        })
        .eq("id", id);

      console.log(`✅ Rotation completed for test ${id}`);

      totalRotations++;

      // ✅ Delay helps prevent YouTube rate limits
      await sleep(500);
    }

    return NextResponse.json(
      { success: true, rotated: totalRotations },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Unexpected server error:", err);

    // ✅ DO NOT fail cron — return 200 OK
    return NextResponse.json(
      { message: "Server error (logged)", error: err.message },
      { status: 200 }
    );
  }
}
