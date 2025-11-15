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
    throw new Error("No refresh token found for user: " + email);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: data.refresh_token,
  });

  // Automatically store new refresh tokens if Google sends them
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.refresh_token) {
      await supabase
        .from("app_users")
        .update({ refresh_token: tokens.refresh_token })
        .eq("email", email);
    }
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
