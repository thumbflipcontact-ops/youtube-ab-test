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

  console.log("📊 DAILY ANALYTICS CRON STARTED");

  try {
    const nowUTC = DateTime.utc().toISO();

    // Get all tests whose analytics are not collected
    const { data: tests, error } = await supabaseAdmin
      .from("ab_tests")
      .select("*")
      .eq("analytics_collected", false);

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
        start_datetime,
        end_datetime,
      } = test;

      const testEnded = DateTime.fromISO(end_datetime) < DateTime.utc();

      console.log(`\n📌 Processing test ${testId} (ended: ${testEnded})`);

      const { youtubeAnalytics } =
        await getYouTubeClientForUserByEmail(user_email);

      //
      // 1️⃣ YouTube analytics query (dimension = day FIXED)
      //
      const report = await youtubeAnalytics.reports.query({
        ids: "channel==MINE",
        startDate: DateTime.fromISO(start_datetime).toISODate(),
        endDate: DateTime.fromISO(end_datetime).toISODate(),
        metrics:
          "views,estimatedMinutesWatched,averageViewDuration,likes,comments,impressions,clickThroughRate,shares,subscribersGained,averageViewPercentage",
        dimensions: "day",
        filters: `video==${video_id}`,
      });

      if (!report.data.rows?.length) {
        console.log("⚠️ No data returned from YouTube");
        continue;
      }

      //
      // 2️⃣ Aggregate daily rows into a single cumulative total
      //
      let totals = {
        views: 0,
        minutes: 0,
        avgDuration: 0,
        likes: 0,
        comments: 0,
        impressions: 0,
        ctr: 0,
        shares: 0,
        subscribers_gained: 0,
        avg_view_percentage: 0,
      };

      for (const row of report.data.rows) {
        totals.views += row[1];
        totals.minutes += row[2];
        totals.avgDuration = row[3]; // averageViewDuration is already averaged
        totals.likes += row[4];
        totals.comments += row[5];
        totals.impressions += row[6];
        totals.ctr = row[7]; // CTR is averaged per day
        totals.shares += row[8];
        totals.subscribers_gained += row[9];
        totals.avg_view_percentage = row[10]; // already % per day
      }

      //
      // 3️⃣ Insert raw snapshot
      //
      await supabaseAdmin.from("analytics_snapshots").insert({
        ab_test_id: testId,
        video_id,
        user_email,
        views: totals.views,
        estimated_minutes_watched: totals.minutes,
        average_view_duration: totals.avgDuration,
        likes: totals.likes,
        comments: totals.comments,
        impressions: totals.impressions,
        click_through_rate: totals.ctr,
        shares: totals.shares,
        subscribers_gained: totals.subscribers_gained,
        average_view_percentage: totals.avg_view_percentage,
        collected_at: nowUTC,
      });

      //
      // 4️⃣ Pull previous snapshot to compute delta
      //
      const { data: prev } = await supabaseAdmin
        .from("analytics_snapshots")
        .select("*")
        .eq("ab_test_id", testId)
        .lt("collected_at", nowUTC)
        .order("collected_at", { ascending: false })
        .limit(1);

      const delta = {
        views: totals.views - (prev?.views || 0),
        minutes: totals.minutes - (prev?.estimated_minutes_watched || 0),
        likes: totals.likes - (prev?.likes || 0),
        comments: totals.comments - (prev?.comments || 0),
        impressions: totals.impressions - (prev?.impressions || 0),
        shares: totals.shares - (prev?.shares || 0),
        subscribers_gained:
          totals.subscribers_gained - (prev?.subscribers_gained || 0),
        avg_view_percentage: totals.avg_view_percentage,
      };

      console.log("📌 Daily Delta:", delta);

      //
      // 5️⃣ Fetch rotation intervals
      //
      const { data: rotations } = await supabaseAdmin
        .from("thumbnail_rotation_log")
        .select("*")
        .eq("ab_test_id", testId);

      if (!rotations?.length) {
        console.log("⚠️ No rotation logs");
        continue;
      }

      // Close active intervals (still running)
      for (const r of rotations) {
        if (!r.ended_at) {
          await supabaseAdmin
            .from("thumbnail_rotation_log")
            .update({ ended_at: nowUTC })
            .eq("id", r.id);

          r.ended_at = nowUTC;
        }
      }

      //
      // 6️⃣ Time weighting per thumbnail
      //
      const timeMap = {};

      for (const r of rotations) {
        const start = DateTime.fromISO(r.started_at);
        const end = DateTime.fromISO(r.ended_at);
        const hours = end.diff(start, "hours").hours;

        if (!timeMap[r.thumbnail_url]) timeMap[r.thumbnail_url] = 0;
        timeMap[r.thumbnail_url] += hours;
      }

      const totalHours = Object.values(timeMap).reduce((a, b) => a + b, 0);
      if (totalHours === 0) continue;

      //
      // 7️⃣ Insert weighted thumbnail analytics
      //
      for (const [thumbnail, hours] of Object.entries(timeMap)) {
        const weight = hours / totalHours;

        await supabaseAdmin.from("thumbnail_performance").insert({
          ab_test_id: testId,
          user_email,
          video_id,
          thumbnail_url: thumbnail,

          views: delta.views * weight,
          estimated_minutes_watched: delta.minutes * weight,
          average_view_duration: totals.avgDuration,
          likes: delta.likes * weight,
          comments: delta.comments * weight,
          impressions: delta.impressions * weight,
          click_through_rate: totals.ctr,

          shares: delta.shares * weight,
          subscribers_gained: delta.subscribers_gained * weight,
          average_view_percentage: totals.avg_view_percentage,

          collected_at: nowUTC,
        });
      }

      //
      // 8️⃣ Mark test complete if ended
      //
      if (testEnded) {
        await supabaseAdmin
          .from("ab_tests")
          .update({ analytics_collected: true })
          .eq("id", testId);
      }

      totalProcessed++;
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
    });
  } catch (err) {
    console.error("❌ Cron Error:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
