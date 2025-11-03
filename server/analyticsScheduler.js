// server/analyticsScheduler.js
import "dotenv/config";
import cron from "node-cron";
import { exec } from "child_process";
import { DateTime } from "luxon";

console.log("📊 Analytics Scheduler started (Pacific Time)...");

/**
 * 🕓 Schedule YouTube analytics sync at 00:00 Pacific Time every day
 */
function scheduleDailyAnalytics() {
  // 0 0 * * * → midnight
  const pacificMidnight = "0 0 * * *";

  console.log("📅 Scheduling daily analytics sync at 00:00 Pacific...");

  cron.schedule(
    pacificMidnight,
    () => {
      const nowPacific = DateTime.now().setZone("America/Los_Angeles").toISO();
      console.log(`🌙 [${nowPacific}] Running YouTube analytics sync job...`);

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
    { timezone: "America/Los_Angeles" } // ✅ ensure cron runs in Pacific time
  );
}

/**
 * 🚀 Start analytics scheduler
 */
function startAnalyticsScheduler() {
  console.log("🚀 Starting daily analytics scheduler (Pacific Time)...");
  scheduleDailyAnalytics();
}

startAnalyticsScheduler();
