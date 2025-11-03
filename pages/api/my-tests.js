// pages/api/my-tests.js
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth].js";
import { supabase } from "../../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user?.email) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { data, error } = await supabase
      .from("ab_tests")
      .select("id, video_id, start_datetime, end_datetime, analytics_collected")
      .eq("user_email", session.user.email)
      .order("id", { ascending: false });

    if (error) throw error;
    return res.status(200).json({ data });
  } catch (err) {
    console.error("❌ Failed to fetch user tests:", err);
    return res.status(500).json({ message: err.message });
  }
}
