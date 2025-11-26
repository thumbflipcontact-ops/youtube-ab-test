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

//
// Helper: robustly read thumbnails from the ab_tests row.
// Tries common column names and formats, returns array of thumbnail URLs (may be empty).
//
async function readThumbnailsForTest(testId) {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from("ab_tests")
      .select("*")
      .eq("id", testId)
      .limit(1);

    if (error) {
      console.error("🔥 Error reading ab_tests row for thumbnails:", error);
      return [];
    }
    if (!rows || !rows.length) return [];

    const row = rows[0];
    const thumbnails = [];

    if (row.thumbnails && Array.isArray(row.thumbnails)) {
      thumbnails.push(...row.thumbnails.filter(Boolean));
    }

    if (row.thumbnail_urls && Array.isArray(row.thumbnail_urls)) {
      thumbnails.push(...row.thumbnail_urls.filter(Boolean));
    }

    if (row.thumbnail && typeof row.thumbnail === "string" && row.thumbnail) {
      thumbnails.push(row.thumbnail);
    }

    for (let i = 1; i <= 10; i++) {
      const k = `thumbnail_${i}`;
      if (Object.prototype.hasOwnProperty.call(row, k) && row[k]) {
        thumbnails.push(row[k]);
      }
    }

    if (row.thumbnails_csv && typeof row.thumbnails_csv === "string") {
      thumbnails.push(
        ...row.thumbnails_csv.split(",").map((s) => s.trim()).filter(Boolean)
      );
    }

    const uniq = Array.from(new Set(thumbnails.filter(Boolean)));
    return uniq;
  } catch (err) {
    console.error("🔥 Unexpected error reading thumbnails for test:", err);
    return [];
  }
}

async function parentExists(testId) {
  const { data, error } = await supabaseAdmin
    .from("ab_tests")
    .select("id")
    .eq("id", testId)
    .limit(1);

  if (error) {
    console.error(`🔥 parentExists check error for ${testId}:`, error);
    // In doubt, return false so we don't insert or mark incorrectly
    return false;
  }

  return !!(data && data.length);
}

function parseDateFlexible(dateStr) {
  if (!dateStr) return null;
  let dt = DateTime.fromISO(dateStr);
  if (!dt.isValid) {
    // try SQL parsing (YYYY-MM-DD HH:mm:ss+ZZ) using fromSQL if available
    try {
      // DateTime.fromSQL exists in luxon
      dt = DateTime.fromSQL(dateStr);
    } catch (e) {
      // fallback: replace space with T
      dt = DateTime.fromISO(String(dateStr).replace(" ", "T"));
    }
  }
  return dt.isValid ? dt : null;
}

export async function GET(req) {
  console.log("🔥 NEW ANALYTICS VERSION RUNNING");

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

      // re-check parent still exists (protect against deletes that happened after the initial select)
      const existsNow = await parentExists(testId);
      if (!existsNow) {
        console.warn(`⛔ SKIP: ab_test ${testId} no longer exists (deleted) — skipping processing.`);
        continue;
      }

      // robustly parse start/end datetimes
      const startDT = parseDateFlexible(start_datetime);
      const endDT = parseDateFlexible(end_datetime);

      const testEnded = endDT ? endDT < DateTime.utc() : false;
      console.log(`\n📌 Processing test ${testId} (ended: ${testEnded})`);
      console.log(`    parsed start: ${startDT ? startDT.toISO() : "INVALID"}, end: ${endDT ? endDT.toISO() : "INVALID"}`);

      // get YouTube client (if this fails we'll skip gracefully)
      let youtubeAnalytics;
      try {
        const client = await getYouTubeClientForUserByEmail(user_email);
        youtubeAnalytics = client.youtubeAnalytics;
      } catch (err) {
        console.error(`🔥 Failed to get YouTube client for ${user_email} (test ${testId}):`, err);
        // don't mark collected so it can be retried
        continue;
      }

      //
      // 1️⃣ FETCH ANALYTICS SAFELY (handles impression errors)
      //
      const params = {
        ids: "channel==MINE",
        startDate: startDT ? startDT.toISODate() : DateTime.utc().toISODate(),
        endDate: endDT ? endDT.toISODate() : DateTime.utc().toISODate(),
        metrics:
          "views,estimatedMinutesWatched,averageViewDuration,likes,comments,impressions,clickThroughRate,shares,subscribersGained,averageViewPercentage",
        dimensions: "day",
        filters: `video==${video_id}`,
      };

      let report;
      try {
        report = await fetchAnalyticsSafe(youtubeAnalytics, params);
      } catch (err) {
        console.error(`🔥 YouTube analytics fetch failed for test ${testId}:`, err);
        // don't mark collected; allow retry
        continue;
      }

      //
      // Candidate flag: did we successfully write anything for this test?
      //
      let wroteSomething = false;

      //
      // 2️⃣ IF YOUTUBE RETURNS **NO ROWS** → INSERT ZERO SNAPSHOT
      //
      if (!report?.data?.rows?.length) {
        console.log("⚠️ YouTube returned NO rows — inserting ZERO snapshot");

        // ensure parent still exists before insert
        if (!(await parentExists(testId))) {
          console.warn(`⛔ SKIP INSERT: parent ab_tests ${testId} missing before zero-snapshot insert.`);
          continue;
        }

        const { error: insertZeroError } = await supabaseAdmin
          .from("analytics_snapshots")
          .insert({
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

        if (insertZeroError) {
          console.error("🔥 ZERO SNAPSHOT INSERT ERROR:", insertZeroError);
        } else {
          console.log("✅ ZERO SNAPSHOT INSERTED for test", testId);
          wroteSomething = true;
        }

        // fallback thumbnail perf rows (Option C)
        const thumbnails = await readThumbnailsForTest(testId);

        if (thumbnails.length === 0) {
          // ensure parent exists again
          if (!(await parentExists(testId))) {
            console.warn(`⛔ SKIP PERF INSERT: parent ab_tests ${testId} missing before fallback single perf insert.`);
          } else {
            const { error: perfErr } = await supabaseAdmin
              .from("thumbnail_performance")
              .insert({
                ab_test_id: testId,
                user_email,
                video_id,
                thumbnail_url: null,
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

            if (perfErr) {
              console.error("🔥 FALLBACK PERF INSERT ERROR (single):", perfErr);
            } else {
              console.log("✅ Fallback thumbnail_performance inserted (single) for test", testId);
              wroteSomething = true;
            }
          }
        } else {
          for (const thumb of thumbnails) {
            if (!(await parentExists(testId))) {
              console.warn(`⛔ SKIP PERF INSERT: parent ab_tests ${testId} missing before fallback thumb insert for ${thumb}`);
              break;
            }

            const { error: perfErr } = await supabaseAdmin
              .from("thumbnail_performance")
              .insert({
                ab_test_id: testId,
                user_email,
                video_id,
                thumbnail_url: thumb,
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

            if (perfErr) {
              console.error("🔥 FALLBACK PERF INSERT ERROR (thumb):", thumb, perfErr);
            } else {
              console.log("✅ Fallback thumbnail_performance inserted for thumb", thumb, "test", testId);
              wroteSomething = true;
            }
          }
        }

        // only mark analytics_collected true if we actually wrote something AND testEnded
        if (testEnded && wroteSomething) {
          const { error: markErr } = await supabaseAdmin
            .from("ab_tests")
            .update({ analytics_collected: true })
            .eq("id", testId);

          if (markErr) {
            console.error("🔥 Error marking test analytics_collected:", markErr);
          } else {
            console.log("✅ Marked test as analytics_collected (no-data)", testId);
          }
        } else {
          if (!wroteSomething) {
            console.warn(`⚠️ Did not write any snapshot/perf for test ${testId}; leaving analytics_collected=false for retry.`);
          } else if (!testEnded) {
            console.log(`ℹ️ Wrote zero snapshot/perf for test ${testId} but test not ended; leaving analytics_collected=false to collect again when ended.`);
          }
        }

        totalProcessed++;
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
      // 4️⃣ INSERT RAW SNAPSHOT (ensure parent exists first)
      //
      if (!(await parentExists(testId))) {
        console.warn(`⛔ SKIP SNAPSHOT INSERT: parent ab_tests ${testId} missing before snapshot insert.`);
        continue;
      }

      const { error: insertSnapshotError } = await supabaseAdmin
        .from("analytics_snapshots")
        .insert({
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

      if (insertSnapshotError) {
        console.error("🔥 SNAPSHOT INSERT ERROR:", insertSnapshotError);
        // Do NOT mark analytics_collected; leave for retry
      } else {
        console.log("✅ SNAPSHOT INSERTED for test", testId);
        wroteSomething = true;
      }

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
        console.log("⚠️ No rotation logs found — inserting fallback performance rows (Option C)");

        // read thumbnails from the test row (best-effort)
        const thumbnails = await readThumbnailsForTest(testId);

        if (thumbnails.length === 0) {
          if (!(await parentExists(testId))) {
            console.warn(`⛔ SKIP FALLBACK PERF INSERT: parent ab_tests ${testId} missing.`);
          } else {
            const { error: perfErr } = await supabaseAdmin
              .from("thumbnail_performance")
              .insert({
                ab_test_id: testId,
                user_email,
                video_id,
                thumbnail_url: null,
                views: delta.views,
                estimated_minutes_watched: delta.minutes,
                average_view_duration: totals.avgDuration,
                likes: delta.likes,
                comments: delta.comments,
                impressions: delta.impressions,
                click_through_rate: finalCTR,
                shares: delta.shares,
                subscribers_gained: delta.subscribers_gained,
                average_view_percentage: finalAvgViewPercentage,
                collected_at: nowUTC,
              });

            if (perfErr) {
              console.error("🔥 FALLBACK PERF INSERT ERROR (single):", perfErr);
            } else {
              console.log("✅ Fallback thumbnail_performance inserted (single) for test", testId);
              wroteSomething = true;
            }
          }
        } else {
          for (const thumb of thumbnails) {
            if (!(await parentExists(testId))) {
              console.warn(`⛔ SKIP FALLBACK PER THUMB INSERT: parent ab_tests ${testId} missing before inserting thumb ${thumb}`);
              break;
            }

            const { error: perfErr } = await supabaseAdmin
              .from("thumbnail_performance")
              .insert({
                ab_test_id: testId,
                user_email,
                video_id,
                thumbnail_url: thumb,
                views: delta.views,
                estimated_minutes_watched: delta.minutes,
                average_view_duration: totals.avgDuration,
                likes: delta.likes,
                comments: delta.comments,
                impressions: delta.impressions,
                click_through_rate: finalCTR,
                shares: delta.shares,
                subscribers_gained: delta.subscribers_gained,
                average_view_percentage: finalAvgViewPercentage,
                collected_at: nowUTC,
              });

            if (perfErr) {
              console.error("🔥 FALLBACK PERF INSERT ERROR (thumb):", thumb, perfErr);
            } else {
              console.log("✅ Fallback thumbnail_performance inserted for thumb", thumb, "test", testId);
              wroteSomething = true;
            }
          }
        }
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
        // 7️⃣ WEIGHTED THUMBNAIL PERFORMANCE (only if we have time slices)
        //
        const timeMap = {};

        for (const r of rotations) {
          const start = parseDateFlexible(r.started_at) || DateTime.fromISO(r.started_at);
          const end = parseDateFlexible(r.ended_at) || DateTime.fromISO(r.ended_at);
          const hours = end && start ? end.diff(start, "hours").hours : 0;

          if (!timeMap[r.thumbnail_url]) timeMap[r.thumbnail_url] = 0;
          timeMap[r.thumbnail_url] += hours;
        }

        const totalHours = Object.values(timeMap).reduce((a, b) => a + b, 0);

        if (totalHours > 0) {
          for (const [thumbnail, hours] of Object.entries(timeMap)) {
            if (!(await parentExists(testId))) {
              console.warn(`⛔ SKIP WEIGHTED PERF INSERT: parent ab_tests ${testId} missing before weighted insert for ${thumbnail}`);
              break;
            }

            const weight = hours / totalHours;

            const { error: perfErr } = await supabaseAdmin
              .from("thumbnail_performance")
              .insert({
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
                shares: totals.shares * weight,
                subscribers_gained: totals.subscribers_gained * weight,
                average_view_percentage: finalAvgViewPercentage,
                collected_at: nowUTC,
              });

            if (perfErr) {
              console.error("🔥 WEIGHTED PERF INSERT ERROR (thumb):", thumbnail, perfErr);
            } else {
              console.log("✅ Weighted thumbnail_performance inserted for", thumbnail, "test", testId);
              wroteSomething = true;
            }
          }
        } else {
          // rotations existed but totalHours == 0 → fallback to per-thumb behavior
          console.log("⚠️ rotations exist but totalHours==0 — inserting fallback rows per thumbnail");
          const thumbnails = await readThumbnailsForTest(testId);

          if (thumbnails.length === 0) {
            if (!(await parentExists(testId))) {
              console.warn(`⛔ SKIP EDGE FALLBACK PERF INSERT: parent ab_tests ${testId} missing.`);
            } else {
              const { error: perfErr } = await supabaseAdmin
                .from("thumbnail_performance")
                .insert({
                  ab_test_id: testId,
                  user_email,
                  video_id,
                  thumbnail_url: null,
                  views: delta.views,
                  estimated_minutes_watched: delta.minutes,
                  average_view_duration: totals.avgDuration,
                  likes: delta.likes,
                  comments: delta.comments,
                  impressions: delta.impressions,
                  click_through_rate: finalCTR,
                  shares: delta.shares,
                  subscribers_gained: delta.subscribers_gained,
                  average_view_percentage: finalAvgViewPercentage,
                  collected_at: nowUTC,
                });

              if (perfErr) {
                console.error("🔥 FALLBACK PERF INSERT ERROR (edge single):", perfErr);
              } else {
                console.log("✅ Edge-case fallback performance inserted (single) for test", testId);
                wroteSomething = true;
              }
            }
          } else {
            for (const thumb of thumbnails) {
              if (!(await parentExists(testId))) {
                console.warn(`⛔ SKIP EDGE FALLBACK PER THUMB: parent ab_tests ${testId} missing before edge thumb ${thumb}`);
                break;
              }

              const { error: perfErr } = await supabaseAdmin
                .from("thumbnail_performance")
                .insert({
                  ab_test_id: testId,
                  user_email,
                  video_id,
                  thumbnail_url: thumb,
                  views: delta.views,
                  estimated_minutes_watched: delta.minutes,
                  average_view_duration: totals.avgDuration,
                  likes: delta.likes,
                  comments: delta.comments,
                  impressions: delta.impressions,
                  click_through_rate: finalCTR,
                  shares: delta.shares,
                  subscribers_gained: delta.subscribers_gained,
                  average_view_percentage: finalAvgViewPercentage,
                  collected_at: nowUTC,
                });

              if (perfErr) {
                console.error("🔥 FALLBACK PERF INSERT ERROR (edge thumb):", thumb, perfErr);
              } else {
                console.log("✅ Edge-case fallback performance inserted for thumb", thumb, "test", testId);
                wroteSomething = true;
              }
            }
          }
        }
      }

      //
      // 8️⃣ MARK TEST COMPLETE ONLY IF WE WROTE SOMETHING AND TEST ENDED
      //
      if (testEnded && wroteSomething) {
        // ensure parent still exists
        if (!(await parentExists(testId))) {
          console.warn(`⛔ SKIP MARK: parent ab_tests ${testId} missing before marking analytics_collected.`);
        } else {
          const { error: markErr } = await supabaseAdmin
            .from("ab_tests")
            .update({ analytics_collected: true })
            .eq("id", testId);

          if (markErr) {
            console.error("🔥 Error marking test analytics_collected:", markErr);
          } else {
            console.log("✅ Marked test as analytics_collected", testId);
          }
        }
      } else {
        if (!testEnded) {
          console.log(`ℹ️ Test ${testId} not ended yet — leaving analytics_collected=false for future runs.`);
        } else if (!wroteSomething) {
          console.warn(`⚠️ Test ${testId} ended but nothing was written (inserts failed). Leaving analytics_collected=false for retry.`);
        }
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
