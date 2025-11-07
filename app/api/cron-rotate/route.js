// app/api/cron-rotate/route.js
import { NextResponse } from "next/server";
import axios from "axios";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getYouTubeClientForUserByEmail } from "../../../lib/youtubeClient";

export async function GET(req) {
  // ✅ Secure cron access
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date().toISOString();

    // ✅ 1️⃣ Fetch tests due for rotation
    const { data: tests, error } = await supabaseAdmin
      .from("ab_tests")
      .select("*")
      .lte("next_run_time", now);

    if (error) {
      console.error("DB error:", error);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    if (!tests?.length) {
      return NextResponse.json({ message: "No rotations due" }, { status: 200 });
    }

    for (const test of tests) {
      // ✅ 2️⃣ Test has ended → mark analytics ready
      if (new Date(test.end_datetime) < new Date()) {
        await supabaseAdmin
          .from("ab_tests")
          .update({ analytics_collected: true })
          .eq("id", test.id);

        continue;
      }

      // ✅ 3️⃣ Pick next thumbnail
      const thumbs = test.thumbnail_urls;
      const imageUrl = thumbs[test.current_index];

      // ✅ 4️⃣ Rotate thumbnail on YouTube
      try {
        const { youtube } = await getYouTubeClientForUserByEmail(test.user_email);

        const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
        const imgBuffer = Buffer.from(response.data);

        await youtube.thumbnails.set({
          videoId: test.video_id,
          media: {
            mimeType: "image/jpeg",
            body: imgBuffer,
          },
        });
      } catch (err) {
        console.error(
          `Thumbnail update failed for test ${test.id}:`,
          err.message
        );
      }

      // ✅ 5️⃣ Compute next run time
      let next = new Date(test.next_run_time);

      if (test.rotation_interval_unit === "minutes") {
        next.setMinutes(next.getMinutes() + test.rotation_interval_value);
      } else if (test.rotation_interval_unit === "hours") {
        next.setHours(next.getHours() + test.rotation_interval_value);
      } else if (test.rotation_interval_unit === "days") {
        next.setDate(next.getDate() + test.rotation_interval_value);
      }

      // ✅ 6️⃣ Update DB
      await supabaseAdmin
        .from("ab_tests")
        .update({
          current_index: (test.current_index + 1) % thumbs.length,
          last_rotation_time: now,
          next_run_time: next.toISOString(),
        })
        .eq("id", test.id);
    }

    return NextResponse.json(
      { message: "Rotation cycle complete" },
      { status: 200 }
    );
  } catch (err) {
    console.error("Cron error:", err);
    return NextResponse.json(
      { error: "Cron execution failed", details: err.message },
      { status: 500 }
    );
  }
}
