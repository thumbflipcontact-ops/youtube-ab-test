// server/scheduler.js
import "dotenv/config";
import cron from "node-cron";
import { exec } from "child_process";
import { DateTime } from "luxon";
import { supabase } from "../lib/supabase.js";

console.log("🕒 Smart Scheduler started (UTC)...");

// Active running jobs map: { testId: { job, running, lastExecAt } }
const activeJobs = new Map();

/** Convert value+unit → cron expression */
function getCronExpression(value, unit) {
  switch (unit) {
    case "seconds": return `*/${value} * * * * *`;
    case "minutes": return `*/${value} * * * *`;
    case "hours":   return `0 */${value} * * *`;
    case "days":    return `0 0 */${value} * *`;
    case "weeks":   return `0 0 */${7 * value} * *`;
    default:        return "0 */4 * * *";
  }
}

/** Fetch all currently active tests (in UTC) */
async function fetchActiveTests() {
  const now = DateTime.utc();

  const { data, error } = await supabase
    .from("ab_tests")
    .select(
      "id, video_id, user_email, start_datetime, end_datetime, rotation_interval_value, rotation_interval_unit, thumbnail_urls, analytics_collected"
    );

  if (error) {
    console.error("❌ Could not load AB tests:", error);
    return [];
  }

  return data.filter((t) => {
    const start = DateTime.fromISO(t.start_datetime, { zone: "utc" });
    const end   = DateTime.fromISO(t.end_datetime,   { zone: "utc" });

    return (
      t.analytics_collected === false &&
      DateTime.utc() >= start &&
      DateTime.utc() <= end &&
      t.thumbnail_urls?.length > 0
    );
  });
}

/** Refresh scheduler jobs — runs every 5 minutes */
async function refreshRotations() {
  console.log("🔁 Refreshing scheduled jobs...");

  const activeTests = await fetchActiveTests();
  const activeIds = new Set(activeTests.map(t => t.id));

  // Stop jobs for tests that are no longer active
  for (const [id, meta] of activeJobs.entries()) {
    if (!activeIds.has(id)) {
      console.log(`🛑 Stopping job for test ${id}`);
      meta.job.stop();
      activeJobs.delete(id);
    }
  }

  // Start jobs for newly active tests
  for (const test of activeTests) {
    const { id, video_id, rotation_interval_value, rotation_interval_unit } = test;

    if (activeJobs.has(id)) continue;

    const cronExp = getCronExpression(rotation_interval_value, rotation_interval_unit);

    console.log(`📅 Scheduling test ${id} — every ${rotation_interval_value} ${rotation_interval_unit} (${cronExp})`);

    const job = cron.schedule(
      cronExp,
      () => {
        const meta = activeJobs.get(id);

        // Prevent overlapping runs
        if (meta?.running) {
          console.log(`⏳ Skipping test ${id} — previous run still active`);
          return;
        }

        console.log(`🔄 Executing rotation for test ${id} at ${DateTime.utc().toISO()}`);

        activeJobs.set(id, { ...meta, running: true });

        exec(`node server/serverCron.js ${id}`, (error, stdout, stderr) => {
          activeJobs.set(id, { running: false });

          if (error) {
            console.error(`❌ Rotation failed for test ${id}:`, error.message);
            if (stderr) console.error("stderr:", stderr);
            return;
          }

          if (stdout.trim()) console.log(stdout.trim());
          if (stderr.trim()) console.warn(stderr.trim());

          console.log(`✅ Rotation finished for test ${id}`);
        });
      },
      { timezone: "UTC" }
    );

    activeJobs.set(id, { job, running: false });
  }

  console.log(`📌 Active scheduled jobs: ${activeJobs.size}`);
}

/** Daily analytics runner */
function scheduleAnalytics() {
  console.log("📊 Scheduling analytics at 00:00 UTC");
  cron.schedule(
    "0 0 * * *",
    () => {
      console.log(`📊 Running analytics at ${DateTime.utc().toISO()}`);
      exec("node server/serverAnalyticsCron.js");
    },
    { timezone: "UTC" }
  );
}

/** Start scheduler */
async function startScheduler() {
  console.log("🚀 Booting scheduler service...");

  await refreshRotations();

  cron.schedule(
    "*/5 * * * *",
    async () => {
      console.log(`🔄 Checking for updated test schedules at ${DateTime.utc().toISO()}`);
      await refreshRotations();
    },
    { timezone: "UTC" }
  );

  scheduleAnalytics();

  console.log("✅ Scheduler running!");
}

startScheduler();
