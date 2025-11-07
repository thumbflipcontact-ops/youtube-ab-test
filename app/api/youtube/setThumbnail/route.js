// app/api/youtube/setThumbnail/route.js
import { NextResponse } from "next/server";
import { google } from "googleapis";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

export async function POST(req) {
  try {
    const { accessToken, videoId, imageUrl } = await req.json();

    if (!accessToken || !videoId || !imageUrl) {
      return NextResponse.json(
        { message: "Missing parameters" },
        { status: 400 }
      );
    }

    // ✅ Download image to temporary file (allowed on Vercel)
    const tempFile = path.join(os.tmpdir(), `${videoId}.jpg`);
    const imgRes = await axios.get(imageUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(tempFile, imgRes.data);

    // ✅ Setup OAuth client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // ✅ Upload thumbnail to YouTube
    const response = await youtube.thumbnails.set({
      videoId,
      media: {
        mimeType: "image/jpeg",
        body: fs.createReadStream(tempFile),
      },
    });

    // ✅ Cleanup temporary file
    try {
      fs.unlinkSync(tempFile);
    } catch (_) {}

    console.log("✅ YouTube thumbnail updated:", response.data);

    return NextResponse.json(
      { success: true, response: response.data },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "❌ Error updating YouTube thumbnail:",
      error?.response?.data || error.message
    );

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
