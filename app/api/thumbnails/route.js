import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const testId = searchParams.get("testId");

  if (!testId) {
    return NextResponse.json({ error: "Missing testId" }, { status: 400 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("thumbnail_performance")
    .select("*")
    .eq("ab_test_id", testId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const map = {};

  for (const r of rows) {
    if (!map[r.thumbnail_url]) {
      map[r.thumbnail_url] = {
        thumbnail_url: r.thumbnail_url,

        // SUM fields
        views: 0,
        impressions: 0,
        likes: 0,
        comments: 0,
        estimated_minutes_watched: 0,
        shares: 0,
        subscribers_gained: 0,

        // AVG fields (store sum and count)
        avg_view_duration_sum: 0,
        avg_view_duration_count: 0,

        ctr_sum: 0,
        ctr_count: 0,

        avg_view_percentage_sum: 0,
        avg_view_percentage_count: 0,

        // Latest timestamp
        latest_collected_at: r.collected_at,
      };
    }

    const agg = map[r.thumbnail_url];

    //
    // SUM METRICS
    //

    agg.views += r.views || 0;
    agg.impressions += r.impressions || 0;
    agg.likes += r.likes || 0;
    agg.comments += r.comments || 0;
    agg.estimated_minutes_watched += r.estimated_minutes_watched || 0;
    agg.shares += r.shares || 0;
    agg.subscribers_gained += r.subscribers_gained || 0;

    //
    // AVERAGE METRICS
    //

    if (r.average_view_duration != null) {
      agg.avg_view_duration_sum += r.average_view_duration;
      agg.avg_view_duration_count++;
    }

    if (r.click_through_rate != null) {
      agg.ctr_sum += r.click_through_rate;
      agg.ctr_count++;
    }

    if (r.average_view_percentage != null) {
      agg.avg_view_percentage_sum += r.average_view_percentage;
      agg.avg_view_percentage_count++;
    }

    //
    // MOST RECENT TIMESTAMP
    //
    if (r.collected_at > agg.latest_collected_at) {
      agg.latest_collected_at = r.collected_at;
    }
  }

  //
  // FINAL AGGREGATED OBJECTS
  //
  const aggregated = Object.values(map).map((item) => ({
    thumbnail_url: item.thumbnail_url,

    // SUM
    views: item.views,
    impressions: item.impressions,
    likes: item.likes,
    comments: item.comments,
    estimated_minutes_watched: item.estimated_minutes_watched,
    shares: item.shares,
    subscribers_gained: item.subscribers_gained,

    // AVG
    average_view_duration:
      item.avg_view_duration_count > 0
        ? item.avg_view_duration_sum / item.avg_view_duration_count
        : 0,

    click_through_rate:
      item.ctr_count > 0 ? item.ctr_sum / item.ctr_count : 0,

    average_view_percentage:
      item.avg_view_percentage_count > 0
        ? item.avg_view_percentage_sum / item.avg_view_percentage_count
        : 0,

    // TIMESTAMP
    latest_collected_at: item.latest_collected_at,
  }));

  return NextResponse.json({ data: aggregated });
}
