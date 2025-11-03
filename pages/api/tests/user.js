// pages/api/tests/user.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabase } from "../../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user?.email) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userEmail = session.user.email;

  const { data, error } = await supabase
    .from("ab_tests")
    .select("id, video_id, start_datetime, end_datetime, analytics_collected")
    .eq("user_email", userEmail)
    .order("start_datetime", { ascending: false });

  if (error) {
    console.error("❌ Failed to fetch user tests:", error);
    return res.status(500).json({ message: "Failed to fetch tests" });
  }

  return res.status(200).json({ tests: data });
}
