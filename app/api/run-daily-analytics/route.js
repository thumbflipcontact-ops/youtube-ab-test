export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { DateTime } from "luxon";
import { google } from "googleapis";
import { getYouTubeClientForUserByEmail } from "../../../lib/youtubeClient";

//
// SAFE WRAPPER to retry analytics without impressions/CTR when YouTube rejects them
//
async function fetchAnalyticsSafe(youtubeAnalytics, params) {
  try {
    return await youtubeAnalytics.reports.query(params);
  } catch (err) {
    const msg = err?.message?.toLowerCase() ?? "";

    const impressionsError =
      msg.includes("impressions") ||
      msg.includes("unknown identifier") ||
      msg.includes("unknown metric");

    if (impressionsError) {
      console.log("⚠️ YouTube rejected impressions/CTR — retrying WITHOUT them…");

      const safeMetrics = params.metrics
        .split(",")
        .filter(
          (m) =>
            m !== "impressions" &&
            m !== "clickThroughRate" &&
            m !== "averageViewPercentage"
        )
        .join(",");

      const saferParams = {
        ...params,
        metrics: safeMetrics,
      };

      return await youtubeAnalytics.reports.query(saferParams);
    }

    throw err;
  }
}

export async function GET(req) {
console.log("🔥 NEW ANALYTICS VERSION RUNNING");   // ← ADD THIS HERE
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  console.log("📊 DAILY ANALYTICS CRON STARTED");

  try {
    const nowUTC = DateTime.utc().toISO();

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
      // 1️⃣ FETCH ANALYTICS SAFELY (handles impression errors)
      //
      const params = {
        ids: "channel==MINE",
        startDate: DateTime.fromISO(start_datetime).toISODate(),
        endDate: DateTime.fromISO(end_datetime).toISODate(),
        metrics:
          "views,estimatedMinutesWatched,averageViewDuration,likes,comments,impressions,clickThroughRate,shares,subscribersGained,averageViewPercentage",
        dimensions: "day",
        filters: `video==${video_id}`,
      };

      const report = await fetchAnalyticsSafe(youtubeAnalytics, params);

      //
      // 2️⃣ IF YOUTUBE RETURNS **NO ROWS** → INSERT ZERO SNAPSHOT
      //
      if (!report?.data?.rows?.length) {
        console.log("⚠️ YouTube returned NO rows — inserting ZERO snapshot");

        await supabaseAdmin.from("analytics_snapshots").insert({
          ab_test_id: testId,
          video_id,
          user_email,
          views: 0,
          estimated_minutes_watched: 0,
          average_view_duration: 0,
          likes: 0,
          comments: 0,
          impressions: 0,
          click_through_rate: 0,
          shares: 0,
          subscribers_gained: 0,
          average_view_percentage: 0,
          collected_at: nowUTC,
        });

        if (testEnded) {
          await supabaseAdmin
            .from("ab_tests")
            .update({ analytics_collected: true })
            .eq("id", testId);
        }

        continue; // go to next test
      }

      //
      // 3️⃣ AGGREGATE VALUES — PARTIAL FIELDS FILLED AS ZERO
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
        avg_view_percentage_weight: 0,
      };

      for (const row of report.data.rows) {
        const [
          day,
          v_views = 0,
          v_minutes = 0,
          v_avgDuration = 0,
          v_likes = 0,
          v_comments = 0,
          v_impressions = 0,
          v_ctr = 0,
          v_shares = 0,
          v_subs = 0,
          v_avg_view_percentage = 0,
        ] = row;

        totals.views += v_views;
        totals.minutes += v_minutes;
        totals.likes += v_likes;
        totals.comments += v_comments;

        if (v_avgDuration != null) totals.avgDuration = v_avgDuration;

        totals.impressions += v_impressions ?? 0;

        if (v_ctr != null && v_impressions > 0) {
          totals.ctr_weighted_sum += v_ctr * v_impressions;
        }

        totals.shares += v_shares ?? 0;
        totals.subscribers_gained += v_subs ?? 0;

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
          ? totals.avg_view_percentage_sum /
            totals.avg_view_percentage_weight
          : 0;

      //
      // 4️⃣ INSERT RAW SNAPSHOT
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
        collected_at: nowUTC,
      });

      //
      // 5️⃣ DELTA CALCULATION
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

      console.log("📌 Delta:", delta);

      //
      // 6️⃣ ROTATION LOGS
      //
      const { data: rotations } = await supabaseAdmin
        .from("thumbnail_rotation_log")
        .select("*")
        .eq("ab_test_id", testId);

      if (!rotations?.length) {
        console.log("⚠️ No rotation logs found");
      } else {
        // ensure all intervals are closed
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
        // 7️⃣ WEIGHTED THUMBNAIL PERFORMANCE
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

        if (totalHours > 0) {
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
              collected_at: nowUTC,
            });
          }
        }
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
      processed: totalProcessed,
    });
  } catch (err) {
    console.error("❌ Cron Error:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
