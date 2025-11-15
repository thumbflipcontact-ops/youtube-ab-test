// server/serverCron.js
import "dotenv/config";
import fs from "fs";
import path from "path";
import axios from "axios";
import sharp from "sharp";
import { google } from "googleapis";
import { DateTime } from "luxon";
import { supabase } from "../lib/supabase.js";

const testId = process.argv[2]; // scheduler passes testId

console.log(`🔧 Worker started — rotating test ${testId}`);

/** Get OAuth2 client for user */
async function getOAuth2Client(email) {
  const { data, error } = await supabase
    .from("app_users")
    .select("refresh_token")
    .eq("email", email)
    .single();

  if (error || !data?.refresh_token) {
    console.error(`❌ No refresh token for ${email}`);
    return null;
  }

  const oauth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + "/api/auth/callback/google"
  );

  oauth.setCredentials({ refresh_token: data.refresh_token });

  try {
    const { credentials } = await oauth.refreshAccessToken();
    oauth.setCredentials(credentials);
    return oauth;
  } catch (err) {
    console.error(`❌ Token refresh failed for ${email}`, err.message);
    return null;
  }
}

/** Rotate thumbnail */
async function rotate(videoId, thumbnailUrl, oauth) {
  try {
    const youtube = google.youtube({ version: "v3", auth: oauth });

    const resp = await axios.get(thumbnailUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(resp.data);
    const mime = resp.headers["content-type"];

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(mime)) throw new Error("Unsupported type " + mime);

    const { width } = await sharp(buffer).metadata();
    if (width < 640) throw new Error("Width < 640px");

    const ext = mime.split("/")[1].replace("jpeg", "jpg");
    const temp = path.join(process.cwd(), `temp-${videoId}.${ext}`);
    fs.writeFileSync(temp, buffer);

    console.log(`📤 Uploading to YouTube for video ${videoId}...`);

    await youtube.thumbnails.set({
      videoId,
      media: {
        mimeType: mime,
        body: fs.createReadStream(temp),
      },
    });

    fs.unlinkSync(temp);

    console.log(`✅ YouTube thumbnail updated for video ${videoId}`);
    return true;
  } catch (err) {
    console.error(`❌ Thumbnail upload error:`, err.message);
    return false;
  }
}

/** Main function */
async function runTestRotation(testId) {
  const { data: test, error } = await supabase
    .from("ab_tests")
    .select("*")
    .eq("id", testId)
    .single();

  if (error || !test) {
    console.error(`❌ Cannot load test ${testId}`);
    return;
  }

  const {
    user_email,
    video_id,
    thumbnail_urls,
    current_index,
    rotation_interval_unit,
    rotation_interval_value,
    last_rotation_time,
  } = test;

  const oauth = await getOAuth2Client(user_email);

  if (!oauth) return;

  const nextIndex = (current_index + 1) % thumbnail_urls.length;
  const nextThumb = thumbnail_urls[nextIndex];

  const success = await rotate(video_id, nextThumb, oauth);

  if (!success) return;

  const now = DateTime.utc();
  const intervalMs =
    rotation_interval_unit === "seconds"
      ? rotation_interval_value * 1000
      : rotation_interval_unit === "minutes"
      ? rotation_interval_value * 60 * 1000
      : rotation_interval_unit === "hours"
      ? rotation_interval_value * 60 * 60 * 1000
      : rotation_interval_unit === "days"
      ? rotation_interval_value * 24 * 60 * 60 * 1000
      : rotation_interval_value * 60 * 60 * 1000;

  const nextRun = now.plus({ milliseconds: intervalMs }).toISO();

  const { error: updateError } = await supabase
    .from("ab_tests")
    .update({
      current_index: nextIndex,
      last_rotation_time: now.toISO(),
      next_run_time: nextRun,
    })
    .eq("id", testId);

  if (updateError) {
    console.error(`❌ Test update failed:`, updateError);
  } else {
    console.log(`✅ Test ${testId} updated. Next at ${nextRun}`);
  }
}

await runTestRotation(testId);
process.exit(0);
