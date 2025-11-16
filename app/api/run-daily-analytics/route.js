export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { DateTime } from "luxon";
import { google } from "googleapis";
import { getYouTubeClientForUserByEmail } from "../../../lib/youtubeClient";

// PST 00:00 runs at 08:00 UTC
export async function GET(req) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  console.log("📊 DAILY ANALYTICS CRON STARTED (PST 00:00)");

  try {
    const nowUTC = DateTime.utc().toISO();

    // 1️⃣ Fetch tests that ended and haven't collected analytics yet
    const { data: tests, error } = await supabaseAdmin
      .from("ab_tests")
      .select("*")
      .eq("analytics_collected", false)
      .lt("end_datetime", nowUTC);

    if (error) throw error;
    if (!tests || tests.length === 0) {
      console.log("ℹ️ No tests due for analytics.");
      return NextResponse.json({ success: true, processed: 0 });
    }

    let totalProcessed = 0;

    for (const test of tests) {
      const {
        id: testId,
        user_email,
        video_id,
        thumbnail_urls,
        start_datetime,
        end_datetime,
      } = test;

      console.log(`\n📌 Test ${testId} — Fetching analytics…`);

      const { youtube } = await getYouTubeClientForUserByEmail(user_email);

      // 2️⃣ YouTube Analytics request (video-level)
      const today = DateTime.utc().toISODate();
      const start = DateTime.fromISO(start_datetime).toISODate();
      const end = DateTime.fromISO(end_datetime).toISODate();

      const report = await youtube.analytics.reports.query({
        ids: "channel==MINE",
        startDate: start,
        endDate: end,
        metrics:
          "views,estimatedMinutesWatched,averageViewDuration,likes,comments,impressions,clickThroughRate",
        filters: `video==${video_id}`,
      });

      const rows = report.data.rows || [];

      if (!rows.length) {
        console.log(`⚠️ No analytics returned for video ${video_id}`);
        continue;
      }

      const [
        views,
        minutes,
        avgDuration,
        likes,
        comments,
        impressions,
        ctr,
      ] = rows[0];

      // 3️⃣ Because thumbnails repeat, we SUM metrics per thumbnail
      const snapshotAtEnd = {
        views,
        minutes,
        avgDuration,
        likes,
        comments,
        impressions,
        ctr,
      };

      // Retrieve previous snapshot (if exists)
      const { data: lastSnapshots } = await supabaseAdmin
        .from("thumbnail_performance")
        .select("*")
        .eq("ab_test_id", testId);

      const last = lastSnapshots && lastSnapshots.length > 0
        ? lastSnapshots[0]
        : null;

      let deltas = {
        views: views - (last?.views || 0),
        minutes: minutes - (last?.estimated_minutes_watched || 0),
        avgDuration,
        likes: likes - (last?.likes || 0),
        comments: comments - (last?.comments || 0),
        impressions: impressions - (last?.impressions || 0),
        ctr,
      };

      // 4️⃣ Distribute delta equally to all thumbnails
      // (best-effort — YouTube does not give thumbnail-level analytics)
      const perThumb = thumbnail_urls.map((url) => ({
        ab_test_id: testId,
        user_email,
        video_id,
        thumbnail_url: url,
        views: deltas.views,
        estimated_minutes_watched: deltas.minutes,
        average_view_duration: deltas.avgDuration,
        likes: deltas.likes,
        comments: deltas.comments,
        impressions: deltas.impressions,
        click_through_rate: deltas.ctr,
        collected_at: nowUTC,
      }));

      await supabaseAdmin.from("thumbnail_performance").insert(perThumb);

      // 5️⃣ Mark analytics collected so it never runs again
      await supabaseAdmin
        .from("ab_tests")
        .update({ analytics_collected: true })
        .eq("id", testId);

      totalProcessed++;
      console.log(`✅ Analytics saved for test ${testId}`);
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
    });
  } catch (err) {
    console.error("❌ Analytics Cron Error:", err);
    return NextResponse.json({ message: err.message }, { status: 200 });
  }
}
