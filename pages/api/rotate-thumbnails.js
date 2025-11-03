import { supabase } from "../../lib/supabase";
import { updateYouTubeThumbnail } from "../../lib/youtubeUpdate";
import { getSession } from "next-auth/react";
// /pages/api/rotate-youtube-thumbnail.js
import { getYouTubeClient } from "../../lib/youtubeClient";
//import { supabase } from "@/lib/supabase";
import fs from "fs";
import path from "path";
import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ message: "Missing videoId" });

  try {
    // Get all thumbnails for this video
    const { data: thumbs, error } = await supabase
      .from("thumbnails_meta")
      .select("*")
      .eq("video_id", videoId)
      .order("created_at", { ascending: true });

    if (error || !thumbs?.length) throw new Error("No thumbnails found for this video.");

    // Pick next thumbnail (simple rotation logic)
    const currentIndex = Math.floor(Date.now() / (1000 * 60 * 15)) % thumbs.length;
    const imageUrl = thumbs[currentIndex].url;

    // Download image to temp file
    const tempPath = path.join(process.cwd(), "temp_thumbnail.jpg");
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(tempPath, Buffer.from(response.data));

    // Upload to YouTube
    const youtube = getYouTubeClient();

    await youtube.thumbnails.set({
      videoId,
      media: {
        mimeType: "image/jpeg",
        body: fs.createReadStream(tempPath),
      },
    });

    fs.unlinkSync(tempPath); // cleanup temp file

    console.log(`✅ Updated YouTube thumbnail for ${videoId} to ${imageUrl}`);

// ✅ Verification step — confirm what YouTube now thinks is the current thumbnail
try {
  const verifyRes = await youtube.videos.list({
    part: "snippet",
    id: videoId,
  });

  const thumbnails = verifyRes.data.items[0]?.snippet?.thumbnails;
  console.log("🧩 YouTube-registered thumbnails:", thumbnails);
} catch (verifyErr) {
  console.error("❌ Could not verify thumbnail:", verifyErr.message);
}

console.log(`✅ Updated YouTube thumbnail for ${videoId} to ${imageUrl}`);

    return res.status(200).json({ success: true, newThumbnail: imageUrl });
  } catch (err) {
    console.error("❌ Failed to update YouTube thumbnail:", err.message);
    return res.status(500).json({ message: err.message });
  }
}
