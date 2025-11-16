export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { DateTime } from "luxon";
import { google } from "googleapis";

const CRON_SECRET = (process.env.CRON_SECRET || "").trim().toLowerCase();

// Helper to build Analytics client
function getYTAnalyticsClient(refreshToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.youtubeAnalytics({ version: "v2", auth: oauth2Client });
}

export async function GET(req) {
  // Validate secret
  const headerSecret = (req.headers.get("x-cron-secret") || "")
    .trim()
    .toLowerCase();
  if (!headerSecret || headerSecret !== CRON_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("📊 Running Daily Analytics (PST 00:00)…");

    // 1️⃣ Fetch tests that ended and have NOT collected analytics
    const { data: tests, error } = await supabaseAdmin
      .from("ab_tests")
      .select("*")
      .eq("analytics_collected", false);

    if (error) throw error;
    if (!tests.length) {
      console.log("ℹ️ No tests pending analytics.");
      return NextResponse.json({ collected: 0 });
    }

    let totalCollected = 0;

    for (const test of tests) {
      const endUTC = DateTime.fromISO(test.end_datetime).toUTC();
      if (endUTC > DateTime.utc()) {
        console.log(`⏳ Test ${test.id} not finished yet.`);
        continue;
      }

      console.log(`📈 Collecting analytics for Test ${test.id}`);

      // Fetch refresh token for this user
      const { data: userRow } = await supabaseAdmin
        .from("app_users")
        .select("refresh_token")
        .eq("email", test.user_email)
        .single();

      if (!userRow?.refresh_token) {
        console.error(
          `❌ No refresh token found for ${test.user_email}. Skipping test ${test.id}.`
        );
        continue;
      }

      const ytAnalytics = getYTAnalyticsClient(userRow.refresh_token);

      // 2️⃣ Pull metrics for EACH thumbnail
      for (const thumbUrl of test.thumbnail_urls) {
        const resp = await ytAnalytics.reports.query({
          ids: "channel==MINE",
          startDate: test.start_datetime.split("T")[0],
          endDate: test.end_datetime.split("T")[0],
          metrics:
            "views,averageViewDuration,likes,comments,estimatedMinutesWatched",
          filters: `video==${test.video_id}`,
        });

        const row = resp.data.rows?.[0];

        await supabaseAdmin.from("thumbnail_performance").insert({
          ab_test_id: test.id,
          user_email: test.user_email,
          video_id: test.video_id,
          thumbnail_url: thumbUrl,
          views: row?.[0] ?? null,
          average_view_duration: row?.[1] ?? null,
          likes: row?.[2] ?? null,
          comments: row?.[3] ?? null,
          estimated_minutes_watched: row?.[4] ?? null,
          collected_at: DateTime.utc().toISO(),
        });
      }

      // 3️⃣ Mark test analytics as collected
      await supabaseAdmin
        .from("ab_tests")
        .update({ analytics_collected: true })
        .eq("id", test.id);

      totalCollected++;
    }

    return NextResponse.json({
      success: true,
      collected: totalCollected,
    });
  } catch (err) {
    console.error("❌ DAILY ANALYTICS ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
