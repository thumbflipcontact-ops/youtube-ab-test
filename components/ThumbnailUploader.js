'use client'
import { useState } from 'react'
import axios from 'axios'

export default function ThumbnailUploader({ thumbnails, setThumbnails, videoId }) {
  const [uploading, setUploading] = useState(false)

  const validateFile = (file) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp", "image/gif"];
    if (!allowed.includes(file.type)) return "Unsupported file type";
    if (file.size > 2 * 1024 * 1024) return "File must be <= 2 MB";
    return null;
  }

  const handleUpload = async (e) => {
  const files = Array.from(e.target.files || [])
  if (!files.length) return;

  if (files.length + thumbnails.length > 10) {
    alert("Max 10 thumbnails");
    return;
  }

  const invalid = files.map(validateFile).find(Boolean)
  if (invalid) { alert(invalid); return }

  setUploading(true);

  try {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("videoId", videoId);

    const res = await axios.post("/api/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (res.data?.urls?.length) {
      setThumbnails([...thumbnails, ...res.data.urls]);
    } else {
      alert("No files uploaded. Check console.");
    }
  } catch (err) {
    console.error("Upload error:", err?.response?.data || err.message);
    alert("Upload failed. See console.");
  } finally {
    setUploading(false);
  }
}

  return (
   <div className="bg-white shadow rounded-lg p-5 text-green-600">
  <label className="text-xl font-bold mb-3">
    Upload Thumbnails <span className="text-green-500 text-sm">(max 10)</span>
  </label>

  <input
    type="file"
    accept="image/*"
    multiple
    onChange={handleUpload}
    disabled={uploading}
    className="block w-full border border-gray-300 rounded-md p-2 text-sm cursor-pointer hover:border-gray-400"
  />

  {uploading && (
    <p className="mt-2 text-sm text-blue-600 animate-pulse">
      Uploading...
    </p>
  )}

  <div className="grid grid-cols-5 gap-3 mt-4">
  {thumbnails.map((t, i) => (
    <img
      key={i}
      src={t}
      alt={`thumb-${i}`}
      className="w-20 h-20 object-cover rounded-md border shadow-sm"
    />
  ))}
</div>
</div>
  )
}
