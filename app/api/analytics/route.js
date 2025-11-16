// app/api/analytics/route.js

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/authOptions";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { DateTime } from "luxon";

// CRON secret check: either query parameter or header
const CRON_SECRET = (process.env.CRON_SECRET || '').trim();

async function getAccessTokenForUser(email) {
  // fetch refresh_token from app_users
  const { data: userRows, error } = await supabaseAdmin
    .from('app_users')
    .select('refresh_token')
    .eq('email', email)
    .limit(1)
    .maybeSingle();

  if (error || !userRows || !userRows.refresh_token) {
    throw new Error('No refresh token for user ' + email);
  }

  const refreshToken = userRows.refresh_token;

  // Exchange refresh token for access token
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error('Failed refresh token: ' + JSON.stringify(data));
  }
  return data.access_token;
}

/**
 * Query YouTube Analytics for a video between start & end ISO times.
 * Uses daily granularity because API returns daily aggregates.
 * Returns an object with views, estimatedMinutesWatched, averageViewDuration, likes, comments, impressions (if available)
 */
async function fetchYouTubeAnalytics(accessToken, videoId, startISO, endISO) {
  // YouTube Analytics reports endpoint (v2)
  // Must use dates in YYYY-MM-DD
  const startDate = DateTime.fromISO(startISO).toISODate();
  const endDate = DateTime.fromISO(endISO).toISODate();

  // metrics: views, estimatedMinutesWatched, averageViewDuration, likes, comments, impressionClickThroughRate (if available)
  const metrics = [
    'views',
    'estimatedMinutesWatched',
    'averageViewDuration',
    'likes',
    'comments',
    'impressionClickThroughRate',
  ].join(',');

  // Use "ids=channel==MINE" — with OAuth this uses the authenticated user's channel
  const url = `https://youtubeanalytics.googleapis.com/v2/reports?dimensions=&endDate=${encodeURIComponent(
    endDate
  )}&ids=channel==MINE&metrics=${encodeURIComponent(metrics)}&startDate=${encodeURIComponent(
    startDate
  )}&filters=video==${encodeURIComponent(videoId)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error('YT Analytics error: ' + JSON.stringify(body));
  }

  // body contains rows & columnHeaders — map to object
  const columns = (body.columnHeaders || []).map((c) => c.name);
  const values = (body.rows && body.rows[0]) || [];

  const out = {};
  columns.forEach((col, i) => {
    out[col] = values[i] ?? null;
  });

  // normalize names
  return {
    views: Number(out.views ?? 0),
    estimatedMinutesWatched: Number(out.estimatedMinutesWatched ?? 0),
    averageViewDuration: Number(out.averageViewDuration ?? 0),
    likes: Number(out.likes ?? 0),
    comments: Number(out.comments ?? 0),
    impressionClickThroughRate: Number(out.impressionClickThroughRate ?? 0),
  };
}

export async function GET(req) {
  // GET supports two modes:
  // 1) session user -> returns thumbnail_performance rows for that user
  // 2) query ?testId= -> return rows for that test (public to session user)
  try {
    const url = new URL(req.url);
    const testId = url.searchParams.get('testId');
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;

    if (testId) {
      const { data, error } = await supabaseAdmin
        .from('thumbnail_performance')
        .select('*')
        .eq('ab_test_id', Number(testId))
        .eq('user_email', userEmail)
        .order('collected_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ data });
    }

    // default: return recent analytics for user
    const { data, error } = await supabaseAdmin
      .from('thumbnail_performance')
      .select('*')
      .eq('user_email', userEmail)
      .order('collected_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    console.error('/api/analytics GET error', err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

/**
 * POST - collector for cron
 *
 * Call with cron_secret either as ?cron_secret=... or header x-cron-secret
 * Behavior:
 *  - Find ab_tests where end_datetime <= now AND analytics_collected = false
 *  - For each test, compute per-thumbnail windows based on start_datetime, rotation interval and number of thumbs
 *  - For each window, call YouTube Analytics and write into thumbnail_performance
 *  - Mark analytics_collected = true for test when done
 */
export async function POST(req) {
  try {
    const url = new URL(req.url);
    const provided = (url.searchParams.get('cron_secret') || req.headers.get('x-cron-secret') || '').trim();
    if (!provided || provided !== CRON_SECRET) {
      console.warn('Unauthorized cron call');
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    console.log('📈 Analytics collector triggered at', DateTime.now().toUTC().toISO());

    // fetch completed tests (end_datetime <= nowUTC) that haven't had analytics collected
    const nowUTC = DateTime.now().toUTC().toISO();

    const { data: tests, error } = await supabaseAdmin
      .from('ab_tests')
      .select('*')
      .lte('end_datetime', nowUTC)
      .eq('analytics_collected', false);

    if (error) {
      console.error('DB error fetching completed tests', error);
      return NextResponse.json({ message: 'DB error' }, { status: 500 });
    }

    if (!tests || tests.length === 0) {
      console.log('No completed tests needing analytics.');
      return NextResponse.json({ collected: 0 });
    }

    let collectedCount = 0;
    const batchRunId = null; // you can generate uuid if desired

    for (const test of tests) {
      try {
        const userEmail = test.user_email;
        const videoId = test.video_id;
        const thumbs = test.thumbnail_urls || [];
        const start = DateTime.fromISO(test.start_datetime).toUTC();
        const end = DateTime.fromISO(test.end_datetime).toUTC();
        const intervalValue = test.rotation_interval_value || 1;
        const intervalUnit = test.rotation_interval_unit || 'hours';

        if (thumbs.length === 0) {
          console.warn('Test has no thumbnails', test.id);
          continue;
        }

        // Obtain access token for this user via refresh token
        const accessToken = await getAccessTokenForUser(userEmail);

        // compute per-thumbnail windows (start + n*interval → min(end, start+(n+1)*interval))
        const windows = thumbs.map((t, idx) => {
          const s = start.plus({ [intervalUnit]: intervalValue * idx });
          const e = s.plus({ [intervalUnit]: intervalValue });
          return {
            url: t,
            index: idx,
            startISO: s.toISO(),
            endISO: e < end ? e.toISO() : end.toISO(),
          };
        });

        // for each window call YT analytics
        for (const w of windows) {
          try {
            // skip windows that are zero-length
            if (DateTime.fromISO(w.endISO) <= DateTime.fromISO(w.startISO)) {
              console.warn('zero-length window', test.id, w);
              continue;
            }

            // fetch analytics
            const metrics = await fetchYouTubeAnalytics(accessToken, videoId, w.startISO, w.endISO);

            // insert into thumbnail_performance (idempotent via unique constraint on (ab_test_id,user_email,thumbnail_url,batch_run_id))
            const { error: insertErr } = await supabaseAdmin
              .from('thumbnail_performance')
              .insert([
                {
                  ab_test_id: test.id,
                  user_email: userEmail,
                  video_id: videoId,
                  thumbnail_url: w.url,
                  impressions: metrics.impressions ?? null,
                  views: metrics.views ?? null,
                  estimated_minutes_watched: metrics.estimatedMinutesWatched ?? null,
                  average_view_duration: metrics.averageViewDuration ?? null,
                  likes: metrics.likes ?? null,
                  comments: metrics.comments ?? null,
                  collected_at: DateTime.utc().toISO(),
                  batch_run_id: batchRunId,
                },
              ]);

            if (insertErr) {
              console.warn('Insert analytics failed (may be duplicate)', insertErr);
            } else {
              console.log('Inserted analytics for test', test.id, 'thumb', w.index);
            }
          } catch (innerErr) {
            console.error('Error collecting metrics for test', test.id, 'window', w, innerErr);
          }
        }

        // mark analytics_collected true for the test (so we do not fetch again)
        const { error: updateErr } = await supabaseAdmin
          .from('ab_tests')
          .update({ analytics_collected: true })
          .eq('id', test.id);

        if (updateErr) {
          console.error('Failed to mark analytics_collected for test', test.id, updateErr);
        } else {
          collectedCount++;
        }
      } catch (userErr) {
        console.error('Error processing test', test.id, userErr);
      }
    } // end tests loop

    return NextResponse.json({ collected: collectedCount }, { status: 200 });
  } catch (err) {
    console.error('/api/analytics POST error', err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
