// ✅ Mark this route as dynamic so Next.js will not try to statically optimize it
export const dynamic = "force-dynamic";
export const fetchCache = "default-no-store";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/authOptions";
import { getYouTubeVideos } from "../../../../lib/youtubeApi";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const accessToken = session.accessToken;

    if (!accessToken) {
      return NextResponse.json(
        { message: "No access token found" },
        { status: 401 }
      );
    }

    // ✅ This is dynamic — allowed now
    const videos = await getYouTubeVideos(accessToken);

    return NextResponse.json(videos, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "YouTube fetch error:",
      error?.response?.data || error.message
    );

    return NextResponse.json(
      { message: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}
