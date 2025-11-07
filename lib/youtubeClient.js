// lib/youtubeClient.js
"use server";

import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getYouTubeClientForUserByEmail(email) {
  const { data, error } = await supabase
    .from("app_users")
    .select("refresh_token")
    .eq("email", email)
    .single();

  if (error || !data?.refresh_token) {
    throw new Error("No refresh token for user " + email);
  }

  const redirectUri =
    process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
      : "http://localhost:3000/api/auth/callback/google";

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: data.refresh_token,
  });

  const youtube = google.youtube({
    version: "v3",
    auth: oauth2Client,
  });

  const youtubeAnalytics = google.youtubeAnalytics({
    version: "v2",
    auth: oauth2Client,
  });

  return { youtube, youtubeAnalytics, oauth2Client };
}
