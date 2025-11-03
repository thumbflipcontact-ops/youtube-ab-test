import { getSession } from "next-auth/react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getYouTubeVideos } from "../../../lib/youtubeApi";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: "Not authenticated" });

  const accessToken = session.accessToken;
  if (!accessToken) return res.status(401).json({ message: "No access token found" });

  try {
    const videos = await getYouTubeVideos(accessToken);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(videos);
  } catch (error) {
    console.error("YouTube fetch error:", error.response?.data || error.message);
    res.status(500).json({ message: "Failed to fetch videos" });
  }
}
