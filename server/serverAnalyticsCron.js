// server/serverAnalyticsCron.js
import "dotenv/config";
import { google } from "googleapis";
import { supabase } from "../lib/supabase.js";
import { DateTime } from "luxon";

console.log("📊 Starting YouTube Analytics Sync (Pacific Time)...");

// ---------------------------
// 1️⃣ Helper: Create OAuth2 client for a specific user
// ---------------------------
function getOAuth2Client(refreshToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
      : "http://localhost:3000/api/auth/callback/google"
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

// ---------------------------
// 2️⃣ Helpers for throttling and token refresh
// ---------------------------
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function refreshAccessToken(oauth2Client, email) {
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    const accessToken = credentials.access_token;

    if (accessToken) {
      await supabase
        .from("app_users")
        .update({ access_token: accessToken })
        .eq("email", email);

      console.log(`🔑 Refreshed access token for ${email}`);
    }

    return accessToken;
  } catch (err) {
    console.error(`⚠️ Failed to refresh token for ${email}:`, err.message);
    return null;
  }
}

// ---------------------------
// 3️⃣ Main analytics collection
// ---------------------------
async function fetchABTestAnalytics() {
  const nowPacific = DateTime.now().setZone("America/Los_Angeles");
  console.log(`🔍 [${nowPacific.toISO()}] Checking ended A/B tests needing analytics...`);

  // Convert Pacific now → UTC ISO string for comparison
  const nowUTC = nowPacific.toUTC().toISO();

  // 🔹 Find tests that ended but aren’t analyzed yet
  const { data: tests, error } = await supabase
    .from("ab_tests")
    .select("*")
    .lte("end_datetime", nowUTC)
    .eq("analytics_collected", false);

  if (error) {
    console.error("❌ Failed to fetch ended tests:", error);
    return;
  }

  if (!tests?.length) {
    console.log("ℹ️ No tests needing analytics found.");
    return;
  }

  console.log(`🧮 Found ${tests.length} ended tests.`);

  // Group tests per user to reuse tokens efficiently
  const testsByUser = tests.reduce((acc, test) => {
    acc[test.user_email] = acc[test.user_email] || [];
    acc[test.user_email].push(test);
    return acc;
  }, {});

  for (const [user_email, userTests] of Object.entries(testsByUser)) {
    console.log(`👤 Processing analytics for user: ${user_email}`);

    // Get user's refresh token
    const { data: userData, error: userErr } = await supabase
      .from("app_users")
      .select("refresh_token")
      .eq("email", user_email)
      .maybeSingle();

    if (userErr || !userData?.refresh_token) {
      console.warn(`⚠️ No refresh_token for ${user_email}, skipping all their tests.`);
      continue;
    }

    const oauth2Client = getOAuth2Client(userData.refresh_token);
    const accessToken = await refreshAccessToken(oauth2Client, user_email);
    if (!accessToken) {
      console.warn(`⚠️ Skipping ${user_email}: unable to refresh access token.`);
      continue;
    }

    const youtubeAnalytics = google.youtubeAnalytics({
      version: "v2",
      auth: oauth2Client,
    });

    // Process each test sequentially for this user
    for (const test of userTests) {
      const {
        id: ab_test_id,
        video_id,
        start_datetime,
        end_datetime,
        thumbnail_urls,
      } = test;

      console.log(`📈 Collecting analytics for Test ${ab_test_id} (video ${video_id})...`);

      try {
        const response = await youtubeAnalytics.reports.query({
          ids: "channel==MINE",
          startDate: DateTime.fromISO(start_datetime).toISODate(),
          endDate: DateTime.fromISO(end_datetime).toISODate(),
          metrics: "views,estimatedMinutesWatched,averageViewDuration,likes,comments",
          dimensions: "video",
          filters: `video==${video_id}`,
        });

        const row = response.data.rows?.[0];
        if (!row) {
          console.warn(`⚠️ No analytics returned for video ${video_id}.`);
          continue;
        }

        const [
          views,
          estimatedMinutesWatched,
          averageViewDuration,
          likes,
          comments,
        ] = row;

        // Avoid duplicates
        const { data: existing } = await supabase
          .from("thumbnail_performance")
          .select("id")
          .eq("ab_test_id", ab_test_id)
          .eq("user_email", user_email)
          .limit(1);

        if (existing?.length) {
          console.log(`⏩ Analytics already stored for test ${ab_test_id}, skipping duplicate insert.`);
          continue;
        }

        // Insert performance data for each thumbnail
        for (const thumb of thumbnail_urls || []) {
          const { error: insertErr } = await supabase
            .from("thumbnail_performance")
            .insert([
              {
                ab_test_id,
                video_id,
                user_email,
                thumbnail_url: thumb,
                views,
                estimated_minutes_watched: estimatedMinutesWatched,
                average_view_duration: averageViewDuration,
                likes,
                comments,
                collected_at: new Date().toISOString(),
              },
            ]);

          if (insertErr)
            console.error(`❌ Insert failed for ${thumb}:`, insertErr.message);
          else
            console.log(`✅ Stored analytics for thumbnail ${thumb}`);
        }

        // Mark test as analyzed
        await supabase
          .from("ab_tests")
          .update({ analytics_collected: true })
          .eq("id", ab_test_id);

        console.log(`🏁 Test ${ab_test_id} marked as analytics_collected ✅`);
      } catch (err) {
        const message = err?.errors?.[0]?.message || err.message;
        console.error(`❌ YouTube API error for test ${ab_test_id}: ${message}`);

        if (message?.includes("quota") || message?.includes("Rate Limit")) {
          console.warn("⏳ Pausing sync for 10 minutes due to quota limit...");
          await sleep(10 * 60 * 1000);
        }
      }

      // Small delay to protect against quota bursts
      await sleep(3000);
    }
  }

  console.log("🎯 Completed analytics sync for all users/tests.");
}

// ---------------------------
// 4️⃣ Run immediately
// ---------------------------
fetchABTestAnalytics();
