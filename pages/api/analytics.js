// pages/api/analytics.js
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth].js";
import { supabase } from "../../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // 🔒 Authenticate user
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user?.email) {
    console.warn("⚠️ Unauthorized request to /api/analytics");
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userEmail = session.user.email;
  const { testId } = req.query; // the A/B test selected by the user

  try {
    // 🎯 Require testId for fetching results
    if (!testId) {
      return res
        .status(400)
        .json({ message: "Missing required parameter: testId" });
    }

    // 🧠 Fetch analytics for this user's specific test
    const { data, error } = await supabase
      .from("thumbnail_performance")
      .select(
        `
        id,
        ab_test_id,
        video_id,
        thumbnail_url,
        views,
        estimated_minutes_watched,
        average_view_duration,
        likes,
        comments,
        collected_at
      `
      )
      .eq("user_email", userEmail)
      .eq("ab_test_id", testId)
      .order("collected_at", { ascending: false });

    if (error) throw error;

    if (!data?.length) {
      console.log(`ℹ️ No analytics found for user ${userEmail} and test ${testId}`);
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("❌ Error fetching analytics:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch analytics data",
      error: err.message,
    });
  }
}
