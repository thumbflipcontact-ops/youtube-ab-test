// components/ThumbnailUploader.js
"use client";

import { supabase } from "../lib/supabaseClient";
import { useState } from "react";

export default function ThumbnailUploader({ videoId, thumbnails, setThumbnails }) {
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);

    const newUrls = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Build filename
      const ext = file.name.split(".").pop();
      const filename = `uploads/${videoId}_${Date.now()}_${i}.${ext}`;

      // ✅ Upload directly to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(filename, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        setLoading(false);
        return;
      }

      // ✅ Get public URL
      const { data: publicData } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(filename);

      const publicUrl = publicData.publicUrl;
      newUrls.push(publicUrl);

      // ✅ Save metadata to DB via tiny API route
      await fetch("/api/save-thumbnail-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, url: publicUrl }),
      });
    }

    // Add new thumbnails into parent state
    setThumbnails([...thumbnails, ...newUrls]);
    setLoading(false);
  };

  return (
    <div className="border p-4 rounded-lg">
      <input type="file" multiple onChange={handleUpload} />
      {loading && <p className="mt-2 text-sm text-gray-600">Uploading…</p>}
    </div>
  );
}
