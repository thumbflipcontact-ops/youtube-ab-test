"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ThumbnailUploader from "../../../../components/ThumbnailUploader";
import ABTestForm from "../../../../components/ABTestForm";

export default function VideoDetailClient({ videoId, userCountry }) {
  const [thumbnails, setThumbnails] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();

  // ✅ Thumbnail rotation preview every 15 sec (unchanged)
  useEffect(() => {
    if (thumbnails.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % thumbnails.length);
    }, 15000);

    return () => clearInterval(interval);
  }, [thumbnails]);

  const currentThumbnail = thumbnails[currentIndex];

  return (
    <div className="p-6 flex flex-col items-center">
      <h1 className="text-base font-semibold mb-3">
        Upload Thumbnails & Create Rotation Schedule
      </h1>

      {/* ✅ Video container (unchanged) */}
      <div className="relative w-[560px] h-[315px] border rounded-lg overflow-hidden shadow-lg">
        <iframe
          className="absolute top-0 left-0 w-full h-full z-0"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=0`}
          allowFullScreen
        ></iframe>

        {currentThumbnail && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-1000"
            style={{ pointerEvents: "none" }}
          >
            <img
              key={currentThumbnail}
              src={currentThumbnail}
              alt="A/B test thumbnail"
              className="w-full h-full object-cover opacity-70 animate-fadeInOut"
            />
          </div>
        )}
      </div>

      {/* ✅ Back link */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-blue-600 hover:text-blue-800 underline text-sm font-medium transition"
        >
          ← Back to My Videos
        </button>
      </div>

      {/* ✅ Uploader */}
      <div className="mt-8 w-full max-w-xl">
        <ThumbnailUploader
          thumbnails={thumbnails}
          setThumbnails={setThumbnails}
          videoId={videoId}
        />
      </div>

      {/* ✅ Unified Paywall-ready AB Test Form */}
      <div className="mt-8 w-full max-w-xl">
        <ABTestForm
          videoId={videoId}
          thumbnails={thumbnails}
          userCountry={userCountry}
        />
      </div>
    </div>
  );
}
