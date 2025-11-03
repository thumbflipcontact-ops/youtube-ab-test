// lib/youtubeApi.js
import axios from "axios";

/**
 * Fetch the authenticated user's uploaded YouTube videos.
 * Uses the OAuth access token provided by NextAuth.
 */
export async function getYouTubeVideos(accessToken) {
  if (!accessToken) {
    console.warn("⚠️ No YouTube access token provided.");
    return [];
  }

  try {
    // 1️⃣ Get the user's channel details (find the "uploads" playlist)
    const channelRes = await axios.get("https://www.googleapis.com/youtube/v3/channels", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        part: "contentDetails",
        mine: true,
      },
    });

    console.log("🎬 YouTube channel response:", channelRes.data);

    const uploadsPlaylistId =
      channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      console.warn("⚠️ No uploads playlist found — this YouTube account may be empty or not linked.");
      return [];
    }

    // 2️⃣ Fetch the user's uploaded videos
    const videosRes = await axios.get("https://www.googleapis.com/youtube/v3/playlistItems", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        part: "snippet,contentDetails",
        playlistId: uploadsPlaylistId,
        maxResults: 50, // maximum allowed per request
      },
    });

    // 3️⃣ Map and format results
    const videos = videosRes.data.items.map((item) => ({
      id: item.contentDetails.videoId,
      title: item.snippet.title,
      thumbnail:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        "",
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
    }));

    console.log(`✅ Retrieved ${videos.length} YouTube videos.`);
    return videos;
  } catch (error) {
    const errData = error.response?.data || error.message;

    // Handle common API errors
    if (error.response?.status === 401) {
      console.error("🚫 YouTube token expired or invalid. User needs to reauthenticate.");
    } else if (error.response?.status === 403) {
      console.error("⚠️ YouTube API quota exceeded or insufficient permissions.");
    }

    console.error("❌ YouTube API error:", errData);
    return [];
  }
}
