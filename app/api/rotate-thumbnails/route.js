// ⚡ Required for dynamic API behavior (cron)
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

/* ------------------------- Helpers ------------------------- */
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
          body: imageBuffer
        }
      });

      return { ok: true };
    } catch (err) {
      if (err.code === 429) {
        console.warn(
          `⚠ Rate limit hit for ${videoId}. Retry ${attempt + 1}/${MAX_RETRIES}`
        );
        await sleep(1500 * (attempt + 1));
        continue;
      }

      console.error("❌ Fatal thumbnail upload error:", err);
      return { ok: false, fatal: true, error: err.message };
    }
  }

  return { ok: false, fatal: false, reason: "rate-limit" };
}

function testHasEnded(test) {
  if (test.analytics_collected) return true;

  if (test.end_datetime) {
    const end = DateTime.fromISO(test.end_datetime).toUTC();
    if (end < DateTime.utc()) return true;
  }

  return false;
}

/* ------------------------- CRON ROUTE ------------------------- */
export async function GET(req) {
  const headerSecret = (req.headers.get("x-cron-secret") || "")
    .trim()
    .toLowerCase();

  if (!headerSecret || headerSecret !== CRON_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("🚀 CRON RUNNING — checking tests due for rotation…");

    const nowUTC = DateTime.utc().toISO();

    const { data: tests, error } = await supabase
      .from("ab_tests")
      .select("*")
      .lte("next_run_time", nowUTC)
      .eq("analytics_collected", false);

    if (error) {
      console.error("❌ Database read error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!tests || tests.length === 0) {
      console.log("ℹ No tests ready to rotate.");
      return NextResponse.json({ rotated: 0 });
    }

    const testsByUser = {};
    for (const test of tests) {
      if (!testsByUser[test.user_email]) testsByUser[test.user_email] = [];
      testsByUser[test.user_email].push(test);
    }

    let totalRotations = 0;

    for (const userEmail of Object.keys(testsByUser)) {
      let userTests = testsByUser[userEmail];

      // Sort by next_run_time
      userTests.sort(
        (a, b) =>
          new Date(a.next_run_time || 0) - new Date(b.next_run_time || 0)
      );

      // Rotate only one test per user at a time
      const test = userTests[0];

      const {
        id,
        video_id,
        thumbnail_urls,
        current_index,
        rotation_interval_unit,
        rotation_interval_value
      } = test;

      if (!thumbnail_urls || thumbnail_urls.length === 0) {
        console.warn(`Skipping test ${id}: no thumbnails available.`);
        continue;
      }

      if (testHasEnded(test)) {
        console.log(`⏹ Test ${id} has ended; skipping.`);
        continue;
      }

      const nextIndex = (current_index + 1) % thumbnail_urls.length;
      const nextThumbnail = thumbnail_urls[nextIndex];

      console.log(`🔄 Rotating video ${video_id} → index ${nextIndex}`);

      const { youtube } = await getYouTubeClientForUserByEmail(userEmail);

      const img = await axios.get(nextThumbnail, {
        responseType: "arraybuffer"
      });

      const uploadResult = await uploadThumbnailSafe(
        youtube,
        video_id,
        Buffer.from(img.data)
      );

      if (!uploadResult.ok) {
        console.warn(
          `⚠ Rotation failed for ${video_id}:`,
          uploadResult.reason || uploadResult.error
        );
        continue;
      }

      // ⭐⭐ FIX: compute next_run_time from *previous* next_run_time, not "now"
      const nextTime = DateTime.fromISO(test.next_run_time)
        .plus({ [rotation_interval_unit]: rotation_interval_value })
        .toUTC();

      await supabase
        .from("ab_tests")
        .update({
          current_index: nextIndex,
          last_rotation_time: DateTime.utc().toISO(),
          next_run_time: nextTime.toISO()
        })
        .eq("id", id);

      console.log(`✅ Test ${id} rotated. Next run: ${nextTime.toISO()}`);

      totalRotations++;

      await sleep(500);
    }

    return NextResponse.json({ success: true, rotated: totalRotations });
  } catch (err) {
    console.error("❌ Unexpected CRON error:", err);
    return NextResponse.json(
      { message: "Cron error logged", error: err.message },
      { status: 200 }
    );
  }
}
