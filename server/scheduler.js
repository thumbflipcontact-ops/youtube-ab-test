// server/scheduler.js
import "dotenv/config";
import cron from "node-cron";
import { exec } from "child_process";
import { DateTime } from "luxon";
import { supabase } from "../lib/supabase.js";

console.log("🕒 Smart Scheduler started (UTC Time)...");

// --- Store active jobs so we don’t duplicate ---
const activeJobs = new Map();

/**
 * 🧮 Convert (value + unit) → cron expression
 */
function getCronExpression(value, unit) {
  switch (unit) {
    case "minutes":
      return `*/${value} * * * *`;
    case "hours":
      return `0 */${value} * * *`;
    case "days":
      return `0 0 */${value} * *`;
    case "weeks":
      return `0 0 */${7 * value} * *`;
    default:
      return "0 */4 * * *"; // fallback: every 4 hours
  }
}

/**
 * 🧠 Fetch currently active A/B tests (UTC)
 */
async function fetchActiveTests() {
  const nowUtc = DateTime.utc();

  const { data, error } = await supabase
    .from("ab_tests")
    .select(
      "id, video_id, start_datetime, end_datetime, rotation_interval_value, rotation_interval_unit"
    );

  if (error) {
    console.error("❌ Failed to fetch active A/B tests:", error);
    return [];
  }

  // 🕓 Filter in JS based on UTC
  return (
    data?.filter((t) => {
      const start = DateTime.fromISO(t.start_datetime, { zone: "utc" });
      const end = DateTime.fromISO(t.end_datetime, { zone: "utc" });
      return nowUtc >= start && nowUtc <= end;
    }) || []
  );
}

/**
 * 🌀 Schedule or cancel rotations dynamically (UTC)
 */
async function refreshRotations() {
  console.log("🔁 Checking for active A/B tests...");

  const activeTests = await fetchActiveTests();
  const activeIds = new Set(activeTests.map((t) => t.id));

  // --- Cancel jobs for tests that are no longer active ---
  for (const [id, job] of activeJobs.entries()) {
    if (!activeIds.has(id)) {
      console.log(`🛑 Cancelling rotation job for test ${id} (no longer active).`);
      job.stop();
      activeJobs.delete(id);
    }
  }

  // --- Create jobs for newly active tests ---
  for (const test of activeTests) {
    const { id, video_id, rotation_interval_value, rotation_interval_unit } = test;

    if (activeJobs.has(id)) continue; // already scheduled

    const cronExp = getCronExpression(
      rotation_interval_value || 4,
      rotation_interval_unit || "hours"
    );

    console.log(
      `📅 Scheduling rotation for video ${video_id} (test ${id}) every ${rotation_interval_value} ${rotation_interval_unit} (${cronExp})`
    );

    const job = cron.schedule(
      cronExp,
      () => {
        const nowUtcIso = DateTime.utc().toISO();
        console.log(`🔁 [${nowUtcIso}] Rotating thumbnails for video ${video_id} (test ${id})...`);
        exec(`node server/serverCron.js ${video_id}`, (error) => {
          if (error) {
            console.error(`❌ Rotation failed for video ${video_id}:`, error);
          } else {
            console.log(`✅ Rotation complete for video ${video_id}`);
          }
        });
      },
      { timezone: "UTC" } // ✅ ensure cron runs in UTC
    );

    activeJobs.set(id, job);
  }

  console.log(`✅ Active rotation jobs: ${activeJobs.size}`);
}

/**
 * 📈 Daily analytics at 00:00 UTC
 */
function scheduleDailyAnalytics() {
  const utcMidnight = "0 0 * * *";

  console.log("📊 Scheduling daily analytics at 00:00 UTC...");

  cron.schedule(
    utcMidnight,
    () => {
      const nowUtcIso = DateTime.utc().toISO();
      console.log(`🌙 [${nowUtcIso}] Running YouTube analytics sync...`);

      exec("node server/serverAnalyticsCron.js", (error, stdout, stderr) => {
        if (error) {
          console.error("❌ Analytics sync failed:", error);
          return;
        }
        console.log(stdout || "✅ Analytics sync completed.");
        if (stderr) console.error(stderr);
      });
    },
    { timezone: "UTC" }
  );
}

/**
 * 🚀 Start the scheduler (UTC)
 */
async function startScheduler() {
  console.log("🚀 Starting Dynamic Scheduler (UTC)...");

  // Run immediately at launch
  await refreshRotations();

  // Recheck every 5 minutes for new/ended tests
  cron.schedule(
    "*/5 * * * *",
    async () => {
      const nowUtcIso = DateTime.utc().toISO();
      console.log(`🔄 [${nowUtcIso}] Refreshing rotation schedule (every 5 min)...`);
      await refreshRotations();
    },
    { timezone: "UTC" }
  );

  // Daily analytics
  scheduleDailyAnalytics();

  console.log("✅ Scheduler setup complete (UTC).");
}

startScheduler();
