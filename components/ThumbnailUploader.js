// components/ThumbnailUploader.js
"use client";

import { supabase } from "../lib/supabaseClient";
import { useState } from "react";

export default function ThumbnailUploader({ videoId, thumbnails, setThumbnails }) {
  const [loading, setLoading] = useState(false);

  const MAX_THUMBNAILS = 10;
  const MAX_FILE_SIZE_MB = 2;
  const ACCEPTED_FORMATS = ["jpg", "jpeg", "png", "gif", "bmp"];

  const handleUpload = async (e) => {
    let files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    // ✅ 1. Check thumbnail count limit
    if (thumbnails.length >= MAX_THUMBNAILS) {
      alert(`You already have ${MAX_THUMBNAILS} thumbnails.`);
      return;
    }

    // ✅ 2. Filter out files > 2MB or invalid formats
    const validFiles = [];
    const rejectedMessages = [];

    files.forEach((file) => {
      const ext = file.name.split(".").pop().toLowerCase();

      // ❌ Invalid format
      if (!ACCEPTED_FORMATS.includes(ext)) {
        rejectedMessages.push(`❌ ${file.name} is not an accepted format.`);
        return;
      }

      // ❌ Too large
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        rejectedMessages.push(`❌ ${file.name} is larger than 2MB.`);
        return;
      }

      validFiles.push(file);
    });

    // ✅ Show alert for rejected files
    if (rejectedMessages.length > 0) {
      alert(rejectedMessages.join("\n"));
    }

    // ✅ No valid files? Stop here
    if (validFiles.length === 0) return;

    // ✅ 3. Enforce max 10 thumbnails TOTAL
    if (thumbnails.length + validFiles.length > MAX_THUMBNAILS) {
      alert(
        `You can only upload ${MAX_THUMBNAILS} thumbnails total. ` +
          `You currently have ${thumbnails.length}.`
      );
      return;
    }

    setLoading(true);

    // ✅ 4. Upload all valid thumbnails in parallel
    const uploadPromises = validFiles.map(async (file, index) => {
      const ext = file.name.split(".").pop();
      const filename = `uploads/${videoId}_${Date.now()}_${index}.${ext}`;

      // ✅ Local preview instantly
      const localPreview = URL.createObjectURL(file);
      setThumbnails((prev) => [...prev, localPreview]);

      // ✅ Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(filename, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      // ✅ Get public Supabase URL
      const { data: publicData } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(filename);

      const publicUrl = publicData.publicUrl;

      // ✅ Replace local preview with real URL
      setThumbnails((prev) =>
        prev.map((thumb) => (thumb === localPreview ? publicUrl : thumb))
      );

      // ✅ Save metadata to your DB
      await fetch("/api/save-thumbnail-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, url: publicUrl }),
      });

      return publicUrl;
    });

    try {
      await Promise.all(uploadPromises);
    } catch (err) {
      console.error("Upload error:", err);
    }

    setLoading(false);
  };

  return (
    <div className="border p-4 rounded-lg">
      <input
        type="file"
        multiple
        onChange={handleUpload}
        disabled={thumbnails.length >= MAX_THUMBNAILS}
      />

      {/* Max limit reached */}
      {thumbnails.length >= MAX_THUMBNAILS && (
        <p className="text-red-600 text-sm mt-2">
          You have reached the maximum of {MAX_THUMBNAILS} thumbnails.
        </p>
      )}

      {loading && (
        <p className="mt-3 text-sm text-gray-600">Uploading thumbnails…</p>
      )}

      {/* ✅ Thumbnail previews */}
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
