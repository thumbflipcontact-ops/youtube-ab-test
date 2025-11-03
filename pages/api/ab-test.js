// pages/api/ab-test.js
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth].js";
import { supabase } from "../../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // 🔒 Verify authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user?.email) {
    console.warn("⚠️ Unauthorized access attempt to /api/ab-test");
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userEmail = session.user.email;

  // 🧩 Normalize incoming data
  const {
    video_id,
    videoId,
    thumbnail_urls,
    thumbnailUrls,
    start_datetime,
    end_datetime,
    title,
    description,
    access_token,
    rotation_interval_value,
    rotation_interval_unit,
  } = req.body;

  const normalizedVideoId = video_id || videoId;
  const normalizedThumbnails = thumbnail_urls || thumbnailUrls;

  console.log("📦 Received body:", req.body);

  if (
    !normalizedVideoId ||
    !normalizedThumbnails?.length ||
    !start_datetime ||
    !end_datetime
  ) {
    return res.status(400).json({
      message:
        "Missing required fields: video_id, thumbnail_urls, start_datetime, end_datetime",
      received: req.body,
    });
  }

  try {
    // 🧠 1️⃣ Insert A/B test entry
    const { data: abTest, error: insertError } = await supabase
      .from("ab_tests")
      .insert([
        {
          video_id: normalizedVideoId,
          thumbnail_urls: normalizedThumbnails,
          start_datetime,
          end_datetime,
          access_token: access_token || null,
          rotation_interval_value: rotation_interval_value || 15,
          rotation_interval_unit: rotation_interval_unit || "minutes",
          current_index: 0,
          last_rotation_time: null,
          analytics_collected: false,
          user_email: userEmail,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    console.log(`✅ A/B Test created successfully for ${userEmail}:`, abTest.id);

    // 🧩 2️⃣ Insert thumbnail metadata entries linked to this test
    const inserts = normalizedThumbnails.map((url) => ({
      video_id: normalizedVideoId,
      url,
      ab_test_id: abTest.id, // 👈 critical link
      created_at: new Date().toISOString(),
    }));

    const { error: thumbError } = await supabase
      .from("thumbnails_meta")
      .insert(inserts);

    if (thumbError)
      console.error("⚠️ Failed to insert some thumbnails_meta:", thumbError);
    else console.log(`🖼️ Inserted ${inserts.length} thumbnail_meta rows`);

    // ✅ 3️⃣ Respond with success
    return res.status(200).json({
      success: true,
      test: abTest,
      thumbnailsInserted: inserts.length,
    });
  } catch (err) {
    console.error("❌ Failed to create A/B test:", err);
    return res.status(500).json({ message: err.message });
  }
}
