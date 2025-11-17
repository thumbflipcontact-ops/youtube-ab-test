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

      // 1️⃣ Get cumulative analytics
      const report = await youtubeAnalytics.reports.query({
        ids: "channel==MINE",
        startDate: DateTime.fromISO(start_datetime).toISODate(),
        endDate: DateTime.fromISO(end_datetime).toISODate(),
        metrics:
          "views,estimatedMinutesWatched,averageViewDuration,likes,comments,impressions,clickThroughRate",
        filters: `video==${video_id}`,
      });

      if (!report.data.rows?.length) {
        console.log("⚠️ No data returned");
        continue;
      }

      const [
        views,
        minutes,
        avgDuration,
        likes,
        comments,
        impressions,
        ctr
      ] = report.data.rows[0];

      // 2️⃣ Insert raw snapshot
      await supabaseAdmin.from("analytics_snapshots").insert({
        ab_test_id: testId,
        video_id,
        user_email,
        views,
        estimated_minutes_watched: minutes,
        average_view_duration: avgDuration,
        likes,
        comments,
        impressions,
        click_through_rate: ctr,
        collected_at: nowUTC
      });

      // 3️⃣ Get previous snapshot (yesterday)
      const { data: prev } = await supabaseAdmin
        .from("analytics_snapshots")
        .select("*")
        .eq("ab_test_id", testId)
        .lt("collected_at", nowUTC)
        .order("collected_at", { ascending: false })
        .limit(1);

      const delta = {
        views: views - (prev?.views || 0),
        minutes: minutes - (prev?.estimated_minutes_watched || 0),
        likes: likes - (prev?.likes || 0),
        comments: comments - (prev?.comments || 0),
        impressions: impressions - (prev?.impressions || 0),
      };

      console.log("📌 Daily Delta:", delta);

      // 4️⃣ Fetch thumbnail rotation intervals
      const { data: rotations } = await supabaseAdmin
        .from("thumbnail_rotation_log")
        .select("*")
        .eq("ab_test_id", testId);

      if (!rotations?.length) {
        console.log("⚠️ No rotation logs");
        continue;
      }

      // Close active intervals
      for (const r of rotations) {
        if (!r.ended_at) {
          await supabaseAdmin
            .from("thumbnail_rotation_log")
            .update({ ended_at: nowUTC })
            .eq("id", r.id);
          r.ended_at = nowUTC;
        }
      }

      // 5️⃣ Time-weight each thumbnail
      const timeMap = {};

      for (const r of rotations) {
        const start = DateTime.fromISO(r.started_at);
        const end = DateTime.fromISO(r.ended_at);
        const hours = end.diff(start, "hours").hours;

        if (!timeMap[r.thumbnail_url]) timeMap[r.thumbnail_url] = 0;
        timeMap[r.thumbnail_url] += hours;
      }

      const totalHours = Object.values(timeMap).reduce((a, b) => a + b, 0);

      if (totalHours === 0) {
        console.log("⚠️ No time intervals found");
        continue;
      }

      // 6️⃣ Insert weighted analytics
      for (const [thumbnail, hours] of Object.entries(timeMap)) {
        const weight = hours / totalHours;

        await supabaseAdmin.from("thumbnail_performance").insert({
          ab_test_id: testId,
          user_email,
          video_id,
          thumbnail_url: thumbnail,
          views: delta.views * weight,
          estimated_minutes_watched: delta.minutes * weight,
          average_view_duration: avgDuration,
          likes: delta.likes * weight,
          comments: delta.comments * weight,
          impressions: delta.impressions * weight,
          click_through_rate: ctr,
          collected_at: nowUTC
        });
      }

      // 7️⃣ If the test ended, mark analytics as complete AFTER the final delta
      if (testEnded) {
        console.log(`✔ Test ${testId} ended — marking analytics_collected = true`);
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
