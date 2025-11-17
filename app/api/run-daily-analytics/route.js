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

    // Fetch tests that are NOT fully collected
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
        end_datetime
      } = test;

      const testEnded = DateTime.fromISO(end_datetime) < DateTime.utc();
      console.log(`\n📌 Processing test ${testId} (ended: ${testEnded})`);

      const { youtubeAnalytics } =
        await getYouTubeClientForUserByEmail(user_email);

      //
      // 1️⃣ SAFE YOUTUBE ANALYTICS REQUEST (dimensions=day REQUIRED)
      //
      const report = await youtubeAnalytics.reports.query({
        ids: "channel==MINE",
        startDate: DateTime.fromISO(start_datetime).toISODate(),
        endDate: DateTime.fromISO(end_datetime).toISODate(),
        metrics:
          "views,estimatedMinutesWatched,averageViewDuration,likes,comments,impressions,clickThroughRate,shares,subscribersGained,averageViewPercentage",
        dimensions: "day", // REQUIRED for impressions
        filters: `video==${video_id}`,
      });

      if (!report.data.rows?.length) {
        console.log("⚠️ No analytics returned from YouTube");
        continue;
      }

      //
      // 2️⃣ WE SUM ACROSS DAYS
      //
      let totals = {
        views: 0,
        minutes: 0,
        avgDuration: 0,

        likes: 0,
        comments: 0,

        impressions: 0,
        ctr_weighted_sum: 0,

        shares: 0,
        subscribers_gained: 0,

        avg_view_percentage_sum: 0,
        avg_view_percentage_weight: 0
      };

      for (const row of report.data.rows) {
        // row = [day, views, minutes, avgDur, likes, comments, impressions, ctr, shares, subs, avgView%]
        const [
          day,
          v_views,
          v_minutes,
          v_avgDuration,
          v_likes,
          v_comments,
          v_impressions,
          v_ctr,
          v_shares,
          v_subs,
          v_avg_view_percentage
        ] = row;

        totals.views += v_views;
        totals.minutes += v_minutes;
        totals.avgDuration = v_avgDuration;

        totals.likes += v_likes;
        totals.comments += v_comments;

        totals.impressions += v_impressions;

        if (v_ctr != null && v_impressions > 0) {
          totals.ctr_weighted_sum += v_ctr * v_impressions;
        }

        totals.shares += v_shares;
        totals.subscribers_gained += v_subs;

        if (v_avg_view_percentage != null && v_views > 0) {
          totals.avg_view_percentage_sum += v_avg_view_percentage * v_views;
          totals.avg_view_percentage_weight += v_views;
        }
      }

      const finalCTR =
        totals.impressions > 0
          ? totals.ctr_weighted_sum / totals.impressions
          : 0;

      const finalAvgViewPercentage =
        totals.avg_view_percentage_weight > 0
          ? totals.avg_view_percentage_sum / totals.avg_view_percentage_weight
          : 0;

      //
      // 3️⃣ INSERT RAW SNAPSHOT
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
        click_through_rate: finalCTR,
        shares: totals.shares,
        subscribers_gained: totals.subscribers_gained,
        average_view_percentage: finalAvgViewPercentage,
        collected_at: nowUTC
      });

      //
      // 4️⃣ GET PREVIOUS SNAPSHOT
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
        average_view_percentage: finalAvgViewPercentage,
      };

      //
      // 5️⃣ THUMBNAIL ROTATION LOGS
      //
      const { data: rotations } = await supabaseAdmin
        .from("thumbnail_rotation_log")
        .select("*")
        .eq("ab_test_id", testId);

      if (!rotations?.length) {
        console.log("⚠️ No rotation logs");
        continue;
      }

      // Close open intervals
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
      // 6️⃣ TIME WEIGHTING
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
      // 7️⃣ INSERT PER-THUMBNAIL ANALYTICS
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
          click_through_rate: finalCTR,

          shares: delta.shares * weight,
          subscribers_gained: delta.subscribers_gained * weight,
          average_view_percentage: finalAvgViewPercentage,

          collected_at: nowUTC
        });
      }

      //
      // 8️⃣ MARK TEST COMPLETE IF ENDED
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
      processed: totalProcessed
    });

  } catch (err) {
    console.error("❌ Cron Error:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
