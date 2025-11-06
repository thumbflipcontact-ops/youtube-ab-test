// /supabase/functions/rotate-thumbnails/index.js
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STAGGER_MINUTES = 15;

function addStagger(date) {
  const d = new Date(date);
  const offset = Math.floor(Math.random() * STAGGER_MINUTES);
  d.setMinutes(d.getMinutes() + offset);
  return d;
}

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SB_URL"),
    Deno.env.get("SB_SERVICE_ROLE_KEY")
  );

  const now = new Date().toISOString();

  const { data: tests, error } = await supabase
    .from("ab_tests")
    .select("*")
    .lte("next_run_time", now);

  if (error) {
    console.error("DB error:", error);
    return new Response("DB Error", { status: 500 });
  }

  if (!tests.length) {
    console.log("No rotations due");
    return new Response("OK");
  }

  for (const test of tests) {
    if (new Date(test.end_datetime) < new Date()) {
      await supabase.from("ab_tests").update({
        analytics_collected: true
      }).eq("id", test.id);
      continue;
    }

    const thumbs = test.thumbnail_urls;
    const imageUrl = thumbs[test.current_index];

    await fetch(`${Deno.env.get("APP_URL")}/api/rotate-thumbnails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: test.user_email,
        videoId: test.video_id,
        imageUrl
      })
    });

    let nextRun = new Date(test.next_run_time);

    switch (test.rotation_interval_unit) {
      case "minutes":
        nextRun.setMinutes(nextRun.getMinutes() + test.rotation_interval_value);
        break;
      case "hours":
        nextRun.setHours(nextRun.getHours() + test.rotation_interval_value);
        break;
      case "days":
        nextRun.setDate(nextRun.getDate() + test.rotation_interval_value);
        break;
    }

    const staggeredNextRun = addStagger(nextRun);

    await supabase.from("ab_tests").update({
      current_index: (test.current_index + 1) % thumbs.length,
      last_rotation_time: now,
      next_run_time: staggeredNextRun.toISOString()
    }).eq("id", test.id);
  }

  return new Response("Done");
});
