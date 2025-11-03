import axios from "axios";

/**
 * Update the YouTube video thumbnail
 * @param {string} videoId - YouTube video ID
 * @param {string} thumbnailUrl - Public URL of the thumbnail
 * @param {string} accessToken - Google OAuth access token
 */
export async function updateYouTubeThumbnail(videoId, thumbnailUrl, accessToken) {
  try {
    const res = await axios({
      method: "POST",
      url: `https://www.googleapis.com/upload/youtube/v3/thumbnails/set`,
      params: { videoId },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      data: await fetch(thumbnailUrl).then(r => r.arrayBuffer()),
    });
    return res.data;
  } catch (error) {
    console.error("Failed to update thumbnail:", error.response?.data || error.message);
    throw error;
  }
}
