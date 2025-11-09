import { headers } from "next/headers";
import VideoDetailClient from "./VideoDetailClient";

export default function VideoDetailPage({ params }) {
  const { videoId } = params;

  // ✅ Detect user country using Vercel headers (recommended)
  const h = headers();
  const userCountry = h.get("x-vercel-ip-country") || "IN"; // fallback to IN

  return (
    <VideoDetailClient
      videoId={videoId}
      userCountry={userCountry}
    />
  );
}
