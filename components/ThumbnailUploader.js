// components/ThumbnailUploader.js
"use client";

import { supabase } from "../lib/supabaseClient";
import { useState } from "react";

export default function ThumbnailUploader({ videoId, thumbnails, setThumbnails }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({}); // { filename: percent }

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);

    // ✅ PARALLEL UPLOADS (SUPER FAST)
    const uploadPromises = Array.from(files).map(async (file, index) => {
      const ext = file.name.split(".").pop();
      const filename = `uploads/${videoId}_${Date.now()}_${index}.${ext}`;

      // ✅ Track local preview instantly (OPTIONAL)
      const localPreview = URL.createObjectURL(file);
      setThumbnails((prev) => [...prev, localPreview]);

      // ✅ Upload the file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(filename, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      // ✅ Get public URL
      const { data: publicData } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(filename);

      const publicUrl = publicData.publicUrl;

      // ✅ Replace local URL with the real Supabase URL
      setThumbnails((prev) =>
        prev.map((thumb) => (thumb === localPreview ? publicUrl : thumb))
      );

      // ✅ Save metadata
      await fetch("/api/save-thumbnail-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, url: publicUrl }),
      });

      return publicUrl;
    });

    // ✅ Wait for ALL uploads to finish (parallel)
    try {
      await Promise.all(uploadPromises);
    } catch (err) {
      console.error("Upload error:", err);
    }

    setLoading(false);
    setProgress({});
  };

  return (
    <div className="border p-4 rounded-lg">
      <input type="file" multiple onChange={handleUpload} />

      {loading && (
        <p className="mt-3 text-sm text-gray-600">Uploading thumbnails…</p>
      )}

      {/* ✅ PREVIEW — live thumbnails */}
      {thumbnails.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {thumbnails.map((url, index) => (
            <div key={index} className="relative">
              <img
                src={url}
                className="w-20 h-20 object-cover rounded border"
                alt={`Thumbnail ${index + 1}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
