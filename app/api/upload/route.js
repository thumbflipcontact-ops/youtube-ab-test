import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  try {
    const formData = await req.formData();

    const videoId = formData.get("videoId");
    const files = formData.getAll("files");

    if (!videoId) {
      return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
    }

    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const uploadedUrls = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const extension = file.type.split("/")[1];
      const filename = `uploads/${videoId}_${Date.now()}_${i}.${extension}`;

      const { data, error } = await supabase.storage
        .from("thumbnails")
        .upload(filename, buffer, {
          contentType: file.type,
        });

      if (error) {
        console.error("Supabase upload error:", error);
        return NextResponse.json(
          { error: "Supabase upload failed", details: error },
          { status: 500 }
        );
      }

      const { data: publicData } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(filename);

      const publicUrl = publicData.publicUrl;

      await supabase
        .from("thumbnails_meta")
        .insert([{ video_id: videoId, url: publicUrl }]);

      uploadedUrls.push(publicUrl);
    }

    return NextResponse.json({ urls: uploadedUrls }, { status: 200 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Server failed to upload files", details: error.message },
      { status: 500 }
    );
  }
}
