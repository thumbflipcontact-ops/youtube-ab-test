// server/scheduler.js
import "dotenv/config";
import cron from "node-cron";
import { exec } from "child_process";
import { DateTime } from "luxon";
import { supabase } from "../lib/supabase.js";

console.log("🕒 Smart Scheduler started (Pacific Time)...");

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
 * 🧠 Fetch currently active A/B tests (Pacific Time)
 */
async function fetchActiveTests() {
  const nowPacific = DateTime.now().setZone("America/Los_Angeles");

  const { data, error } = await supabase
    .from("ab_tests")
    .select(
      "id, video_id, start_datetime, end_datetime, rotation_interval_value, rotation_interval_unit"
    );

  if (error) {
    console.error("❌ Failed to fetch active A/B tests:", error);
    return [];
  }

  // 🕓 Filter in JS based on Pacific time
  return (
    data?.filter((t) => {
      const start = DateTime.fromISO(t.start_datetime).setZone("America/Los_Angeles");
      const end = DateTime.fromISO(t.end_datetime).setZone("America/Los_Angeles");
      return nowPacific >= start && nowPacific <= end;
    }) || []
  );
}

/**
 * 🌀 Schedule or cancel rotations dynamically
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
        const nowPacific = DateTime.now().setZone("America/Los_Angeles").toISO();
        console.log(`🔁 [${nowPacific}] Rotating thumbnails for video ${video_id} (test ${id})...`);
        exec(`node server/serverCron.js ${video_id}`, (error) => {
          if (error) {
            console.error(`❌ Rotation failed for video ${video_id}:`, error);
          } else {
            console.log(`✅ Rotation complete for video ${video_id}`);
          }
        });
      },
      { timezone: "America/Los_Angeles" } // ✅ ensure cron runs in Pacific time
    );

    activeJobs.set(id, job);
  }

  console.log(`✅ Active rotation jobs: ${activeJobs.size}`);
}

/**
 * 📈 Daily analytics at 00:00 Pacific
 */
function scheduleDailyAnalytics() {
  const pacificMidnight = "0 0 * * *";

  console.log("📊 Scheduling daily analytics at 00:00 Pacific...");

  cron.schedule(
    pacificMidnight,
    () => {
      const nowPacific = DateTime.now().setZone("America/Los_Angeles").toISO();
      console.log(`🌙 [${nowPacific}] Running YouTube analytics sync...`);

      exec("node server/serverAnalyticsCron.js", (error, stdout, stderr) => {
        if (error) {
          console.error("❌ Analytics sync failed:", error);
          return;
        }
        console.log(stdout || "✅ Analytics sync completed.");
        if (stderr) console.error(stderr);
      });
    },
    { timezone: "America/Los_Angeles" }
  );
}

/**
 * 🚀 Start the scheduler
 */
async function startScheduler() {
  console.log("🚀 Starting Dynamic Scheduler...");

  // Run immediately at launch
  await refreshRotations();

  // Recheck every 5 minutes for new/ended tests
  cron.schedule(
    "*/5 * * * *",
    async () => {
      const nowPacific = DateTime.now().setZone("America/Los_Angeles").toISO();
      console.log(`🔄 [${nowPacific}] Refreshing rotation schedule (every 5 min)...`);
      await refreshRotations();
    },
    { timezone: "America/Los_Angeles" }
  );

  // Daily analytics
  scheduleDailyAnalytics();

  console.log("✅ Scheduler setup complete (Pacific Time).");
}

startScheduler();
