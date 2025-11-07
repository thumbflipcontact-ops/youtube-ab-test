// app/api/rotate-thumbnails/route.js
import { NextResponse } from "next/server";
import axios from "axios";
import { getYouTubeClientForUserByEmail } from "../../../lib/youtubeClient";

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, videoId, imageUrl } = body;

    if (!email || !videoId || !imageUrl) {
      return NextResponse.json(
        { message: "Missing email, videoId or imageUrl" },
        { status: 400 }
      );
    }

    // ✅ Get authenticated YouTube client with refreshed tokens
    const { youtube } = await getYouTubeClientForUserByEmail(email);

    // ✅ Download the thumbnail to memory
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    // ✅ Upload to YouTube using Data API
    await youtube.thumbnails.set({
      videoId,
      media: {
        mimeType: "image/jpeg",
        body: Buffer.from(response.data),
      },
    });

    console.log(`✅ Rotated thumbnail for ${videoId} → ${imageUrl}`);

    return NextResponse.json(
      { success: true, newThumbnail: imageUrl },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Thumbnail rotation failed:", err.message);
    return NextResponse.json(
      { message: err.message },
      { status: 500 }
    );
  }
}
