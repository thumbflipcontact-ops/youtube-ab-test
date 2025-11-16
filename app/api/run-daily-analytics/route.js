export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { DateTime } from "luxon";
import { google } from "googleapis";
import { getYouTubeClientForUserByEmail } from "../../../lib/youtubeClient";

export async function GET(req) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  console.log("📊 DAILY ANALYTICS CRON STARTED (PST 00:00)");

  try {
    const nowUTC = DateTime.utc().toISO();

    const { data: tests, error } = await supabaseAdmin
      .from("ab_tests")
      .select("*")
      .eq("analytics_collected", false)
      .lt("end_datetime", nowUTC);

    if (error) throw error;
    if (!tests?.length) {
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

      console.log(`\n📌 Fetching analytics for test ${testId}`);

      const { youtubeAnalytics } =
        await getYouTubeClientForUserByEmail(user_email);

      // ========= IMPORTANT FIX =========
      const report = await youtubeAnalytics.reports.query({
        ids: "channel==MINE",
        startDate: DateTime.fromISO(start_datetime).toISODate(),
        endDate: DateTime.fromISO(end_datetime).toISODate(),
        metrics:
          "views,estimatedMinutesWatched,averageViewDuration,likes,comments,impressions,clickThroughRate",
        filters: `video==${video_id}`,
      });

      if (!report.data.rows || !report.data.rows.length) {
        console.log("⚠️ No analytics returned");
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
      ] = report.data.rows[0];

      // Previous snapshot?
      const { data: lastSnapshots } = await supabaseAdmin
        .from("thumbnail_performance")
        .select("*")
        .eq("ab_test_id", testId);

      const last = lastSnapshots?.[0] || null;

      const deltas = {
        views: views - (last?.views || 0),
        minutes: minutes - (last?.estimated_minutes_watched || 0),
        avgDuration,
        likes: likes - (last?.likes || 0),
        comments: comments - (last?.comments || 0),
        impressions: impressions - (last?.impressions || 0),
        ctr,
      };

      // Distribute across thumbnails
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

      await supabaseAdmin
        .from("ab_tests")
        .update({ analytics_collected: true })
        .eq("id", testId);

      totalProcessed++;
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
    });
  } catch (err) {
    console.error("❌ Analytics Cron Error:", err);
    return NextResponse.json({ message: err.message });
  }
}
