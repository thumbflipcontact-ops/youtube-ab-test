// /lib/youtubeClient.js
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function getYouTubeClientForUserByEmail(email) {
  // fetch refresh token (server side)
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("refresh_token")
    .eq("email", email)
    .limit(1)
    .single();

  if (error || !data?.refresh_token) throw new Error("No refresh token for user");

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:3000/api/auth/callback/google"
  );

  oauth2Client.setCredentials({
    refresh_token: data.refresh_token,
  });

  const youtube = google.youtube({ version: "v3", auth: oauth2Client });
  const youtubeAnalytics = google.youtubeAnalytics({ version: "v2", auth: oauth2Client });

  return { youtube, youtubeAnalytics, oauth2Client };
}
