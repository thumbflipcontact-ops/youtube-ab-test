// =============================================================
// NEXT.JS ROUTE CONFIG (must be first)
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

// Normalize secret
const CRON_SECRET = (process.env.CRON_SECRET || "").trim().toLowerCase();

// Sleep helper
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Upload thumbnail with retries
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
      // Rate limit retry
      if (err.code === 429 || err.response?.status === 429) {
        console.warn(`⚠️ Rate limit for ${videoId}. Retrying attempt ${attempt + 1}`);
        await sleep(1500);
        continue;
      }

      // 401 unauthorized → token expired → probably needs refresh
      console.error("❌ YouTube Upload Error:", err.response?.data || err.message);
      return { ok: false, fatal: true, error: err.message };
    }
  }

  return { ok: false, fatal: false, reason: "rate-limit" };
}

// Test end logic
function testHasEnded(test) {
  if (test.analytics_collected) return true;

  if (test.end_datetime) {
    const end = DateTime.fromISO(test.end_datetime).toUTC();
    if (end < DateTime.now().toUTC()) return true;
  }

  return false;
}

// =============================================================
// CRON HANDLER
// =============================================================
export async function GET(req) {
  // Validate secret
  const headerSecret = (req.headers.get("x-cron-secret") || "")
    .trim()
    .toLowerCase();

  if (!headerSecret || headerSecret !== CRON_SECRET) {
    console.log("❌ Invalid cron secret");
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("🚀 Cron Triggered at", DateTime.now().toUTC().toISO());

    const nowUTC = DateTime.now().toUTC().toISO();

    // Fetch tests whose next_run_time <= now
    const { data: tests, error } = await supabase
      .from("ab_tests")
      .select("*")
      .lte("next_run_time", nowUTC)
      .eq("analytics_collected", false);

    if (error) {
      console.error("❌ Supabase fetch error:", error);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    if (!tests || tests.length === 0) {
      console.log("ℹ️ No tests due for rotation.");
      return NextResponse.json({ rotated: 0 });
    }

    console.log(`📌 ${tests.length} test(s) are due.`);

    // Group by user → rotate one test per user
    const testsByUser = {};
    for (const t of tests) {
      if (!testsByUser[t.user_email]) testsByUser[t.user_email] = [];
      testsByUser[t.user_email].push(t);
    }

    let rotatedCount = 0;

    for (const userEmail of Object.keys(testsByUser)) {
      let userTests = testsByUser[userEmail];

      // Sort by next_run_time
      userTests.sort(
        (a, b) =>
          new Date(a.next_run_time || 0) -
          new Date(b.next_run_time || 0)
      );

      const test = userTests[0];

      const {
        id,
        video_id,
        thumbnail_urls,
        current_index,
        rotation_interval_unit,
        rotation_interval_value,
      } = test;

      console.log(`🔍 Checking test ${id} for user ${userEmail}`);

      if (!thumbnail_urls || thumbnail_urls.length === 0) {
        console.warn(`⚠️ Test ${id} skipped: no thumbnails.`);
        continue;
      }

      if (testHasEnded(test)) {
        console.log(`⏹️ Test ${id} ended. Skipping rotation.`);
        continue;
      }

      const nextIndex = (current_index + 1) % thumbnail_urls.length;
      const nextThumbnail = thumbnail_urls[nextIndex];

      console.log(`🔄 Rotating video ${video_id}, next thumbnail index ${nextIndex}`);

      // Get YouTube API client (refresh token inside)
      const yt = await getYouTubeClientForUserByEmail(userEmail);

      if (!yt?.youtube) {
        console.error(`❌ No YouTube client available for ${userEmail}`);
        continue;
      }

      // Fetch image
      const img = await axios.get(nextThumbnail, { responseType: "arraybuffer" });

      // Upload
      const result = await uploadThumbnailSafe(
        yt.youtube,
        video_id,
        Buffer.from(img.data)
      );

      if (!result.ok) {
        console.warn(`⚠️ Rotation failed for test ${id} reason:`, result.reason || result.error);
        continue;
      }

      console.log(`✅ Thumbnail rotated for test ${id}`);

      // Compute next run
      const nextRun = DateTime.now()
        .toUTC()
        .plus({ [rotation_interval_unit]: rotation_interval_value })
        .toISO();

      await supabase
        .from("ab_tests")
        .update({
          current_index: nextIndex,
          last_rotation_time: DateTime.now().toUTC().toISO(),
          next_run_time: nextRun,
        })
        .eq("id", id);

      rotatedCount++;
      await sleep(500);
    }

    return NextResponse.json(
      { success: true, rotated: rotatedCount },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Cron handler error:", err);
    return NextResponse.json(
      { error: err.message, success: false },
      { status: 200 }
    );
  }
}
