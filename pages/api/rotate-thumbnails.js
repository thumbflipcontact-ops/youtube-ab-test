// /pages/api/rotate-thumbnails.js

import { supabase } from "../../lib/supabase";
import axios from "axios";
import { getYouTubeClientForUserByEmail } from "../../lib/youtubeClient";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const { email, videoId, imageUrl } = req.body;

  if (!email || !videoId || !imageUrl) {
    return res.status(400).json({ message: "Missing email, videoId or imageUrl" });
  }

  try {
    // ✅ Get fresh YouTube client (refresh token handled automatically)
    const { youtube } = await getYouTubeClientForUserByEmail(email);

    // ✅ Download thumbnail into memory
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    // ✅ Upload via YouTube Data API (legal + compliant)
    await youtube.thumbnails.set({
      videoId,
      media: {
        mimeType: "image/jpeg",
        body: Buffer.from(response.data)
      }
    });

    console.log(`✅ Rotated thumbnail for ${videoId} → ${imageUrl}`);

    return res.status(200).json({ success: true, newThumbnail: imageUrl });

  } catch (err) {
    console.error("❌ Thumbnail rotation failed:", err.message);
    return res.status(500).json({ message: err.message });
  }
}
