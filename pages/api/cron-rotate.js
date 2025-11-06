// /pages/api/cron-rotate.js
import { supabase } from "../../lib/supabase";
import { getYouTubeClientForUserByEmail } from "../../lib/youtubeClient";
import axios from "axios";

export default async function handler(req, res) {
  // Security: Only allow cron-job.org (NO public access)
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const now = new Date().toISOString();

    // 1️⃣ Fetch all due rotations
    const { data: tests, error } = await supabase
      .from("ab_tests")
      .select("*")
      .lte("next_run_time", now);

    if (error) {
      console.error("DB error:", error);
      return res.status(500).json({ error: "DB error" });
    }

    if (!tests.length) {
      return res.status(200).json({ message: "No rotations due" });
    }

    for (const test of tests) {
      // 2️⃣ End test if past end date
      if (new Date(test.end_datetime) < new Date()) {
        await supabase
          .from("ab_tests")
          .update({ analytics_collected: true })
          .eq("id", test.id);

        continue;
      }

      // 3️⃣ Get next thumbnail
      const thumbs = test.thumbnail_urls;
      const imageUrl = thumbs[test.current_index];

      // 4️⃣ Rotate thumbnail
      const { youtube } = await getYouTubeClientForUserByEmail(test.user_email);

      try {
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
        console.error("Thumbnail update failed:", err.message);
      }

      // 5️⃣ Compute next run time
      let next = new Date(test.next_run_time);

      if (test.rotation_interval_unit === "minutes") {
        next.setMinutes(next.getMinutes() + test.rotation_interval_value);
      } else if (test.rotation_interval_unit === "hours") {
        next.setHours(next.getHours() + test.rotation_interval_value);
      } else if (test.rotation_interval_unit === "days") {
        next.setDate(next.getDate() + test.rotation_interval_value);
      }

      // 6️⃣ Update DB
      await supabase
        .from("ab_tests")
        .update({
          current_index: (test.current_index + 1) % thumbs.length,
          last_rotation_time: now,
          next_run_time: next.toISOString(),
        })
        .eq("id", test.id);
    }

    res.status(200).json({ message: "Rotation cycle complete" });
  } catch (err) {
    console.error("Cron error:", err);
    res.status(500).json({ error: "Cron execution failed" });
  }
}
