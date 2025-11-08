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
    // ✅ Step 1: Get the user's channel to find the uploads playlist
    const channelRes = await axios.get(
      "https://www.googleapis.com/youtube/v3/channels",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          part: "contentDetails",
          mine: true,
        },
      }
    );

    const items = channelRes.data?.items;
    if (!items || items.length === 0) {
      console.warn("⚠️ No channel found for this account.");
      return [];
    }

    const uploadsPlaylistId =
      items[0].contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      console.warn(
        "⚠️ No uploads playlist found — the user may have no linked YouTube channel."
      );
      return [];
    }

    // ✅ Step 2: Fetch videos from the uploads playlist
    const videos = [];
    let nextPageToken = null;

    do {
      const videosRes = await axios.get(
        "https://www.googleapis.com/youtube/v3/playlistItems",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            part: "snippet,contentDetails",
            playlistId: uploadsPlaylistId,
            maxResults: 50,
            pageToken: nextPageToken || undefined,
          },
        }
      );

      const pageItems = videosRes.data.items || [];
      for (const item of pageItems) {
        videos.push({
          id: item.contentDetails?.videoId || null,
          title: item.snippet?.title || "",
          thumbnail:
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            "",
          publishedAt: item.snippet?.publishedAt || null,
          description: item.snippet?.description || "",
        });
      }

      nextPageToken = videosRes.data.nextPageToken;
    } while (nextPageToken);

    console.log(`✅ Retrieved ${videos.length} YouTube videos.`);
    return videos;
  } catch (error) {
    const errData = error.response?.data || error.message;

    // ✅ Common YouTube API errors
    if (error.response?.status === 401) {
      console.error(
        "🚫 YouTube access token expired or invalid — user must re-authenticate."
      );
    } else if (error.response?.status === 403) {
      console.error(
        "⚠️ YouTube API quota exceeded OR OAuth scope is missing (must include: youtube.readonly)."
      );
    } else if (error.response?.status === 400) {
      console.error("⚠️ Bad request — possible invalid parameters.");
    }

    console.error("❌ YouTube API error:", errData);
    return [];
  }
}
