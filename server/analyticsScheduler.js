// server/analyticsScheduler.js
import "dotenv/config";
import cron from "node-cron";
import { exec } from "child_process";
import { DateTime } from "luxon";

console.log("📊 Analytics Scheduler started (UTC)...");

/**
 * 🕓 Schedule YouTube analytics sync at 00:00 UTC every day
 */
function scheduleDailyAnalytics() {
  // 0 0 * * * → midnight UTC
  const utcMidnight = "0 0 * * *";

  console.log("📅 Scheduling daily analytics sync at 00:00 UTC...");

  cron.schedule(
    utcMidnight,
    () => {
      const nowUtc = DateTime.utc().toISO();
      console.log(`🌙 [${nowUtc}] Running YouTube analytics sync job...`);

      exec("node server/serverAnalyticsCron.js", (error, stdout, stderr) => {
        if (error) {
          console.error("❌ Analytics sync failed:", error);
          return;
        }
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        console.log("✅ Analytics sync completed successfully.");
      });
    },
    { timezone: "UTC" } // ✅ run at UTC truly at midnight UTC
  );
}

/**
 * 🚀 Start analytics scheduler
 */
function startAnalyticsScheduler() {
  console.log("🚀 Starting daily analytics scheduler (UTC)...");
  scheduleDailyAnalytics();
}

startAnalyticsScheduler();
