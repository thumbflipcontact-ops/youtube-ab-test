// pages/api/youtube/setThumbnail.js
import { google } from "googleapis";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { accessToken, videoId, imageUrl } = req.body;
    if (!accessToken || !videoId || !imageUrl) {
      return res.status(400).json({ message: "Missing parameters" });
    }

    // Download image temporarily
    const tempFile = path.join(os.tmpdir(), `${videoId}.jpg`);
    const imgRes = await axios.get(imageUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(tempFile, imgRes.data);

    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    // Use YouTube API
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const response = await youtube.thumbnails.set({
      videoId,
      media: {
        mimeType: "image/jpeg",
        body: fs.createReadStream(tempFile),
      },
    });

    fs.unlinkSync(tempFile); // cleanup

    console.log("✅ YouTube thumbnail updated:", response.data);
    res.status(200).json({ success: true, response: response.data });
  } catch (error) {
    console.error("❌ Error updating YouTube thumbnail:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
}
