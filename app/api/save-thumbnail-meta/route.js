// app/api/save-thumbnail-meta/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(req) {
  try {
    const { videoId, url } = await req.json();

    if (!videoId || !url) {
      return NextResponse.json(
        { error: "Missing videoId or url" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("thumbnails_meta")
      .insert([{ video_id: videoId, url }]);

    if (error) {
      console.error("DB insert error:", error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error", details: err.message },
      { status: 500 }
    );
  }
}
