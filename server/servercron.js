// server/serverCron.js
import { google } from "googleapis";
import dotenv from "dotenv";
import "dotenv/config";
import path from "path";
import fs from "fs";
import axios from "axios";
import sharp from "sharp";
import cron from "node-cron";
import { DateTime } from "luxon";
import { supabase } from "../lib/supabase.js";

console.log("🕒 Thumbnail rotation cron started (Pacific Time)...");

// -------------------------------------------------
// 1️⃣ Helper: Convert interval to milliseconds
// -------------------------------------------------
function getIntervalMs(value, unit) {
  switch (unit) {
    case "seconds":
      return value * 1000;
    case "minutes":
      return value * 60 * 1000;
    case "hours":
      return value * 60 * 60 * 1000;
    case "days":
      return value * 24 * 60 * 60 * 1000;
    default:
      return value * 60 * 1000;
  }
}

// -------------------------------------------------
// 2️⃣ Helper: Get a fresh OAuth2 client for a user
// -------------------------------------------------
async function getOAuth2ClientForUser(userEmail) {
  const { data: user, error } = await supabase
    .from("app_users")
    .select("refresh_token")
    .eq("email", userEmail)
    .single();

  if (error || !user?.refresh_token) {
    console.warn(`⚠️ No refresh token found for ${userEmail}`);
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
      : "http://localhost:3000/api/auth/callback/google"
  );

  oauth2Client.setCredentials({
    refresh_token: user.refresh_token,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    return oauth2Client;
  } catch (err) {
    console.error(`❌ Failed to refresh token for ${userEmail}: ${err.message}`);
    return null;
  }
}

// -------------------------------------------------
// 3️⃣ Upload new thumbnail to YouTube
// -------------------------------------------------
async function rotateThumbnail(videoId, imageUrl, oauth2Client) {
  try {
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data);
    const mimeType = response.headers["content-type"];

    // ✅ Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(mimeType))
      throw new Error(`Unsupported type: ${mimeType}`);

    // ✅ Validate size
    const sizeMB = buffer.length / (1024 * 1024);
    if (sizeMB > 2) throw new Error(`File too large (${sizeMB.toFixed(2)} MB)`);

    // ✅ Validate dimensions
    const { width, height } = await sharp(buffer).metadata();
    if (width < 640) throw new Error(`Width too small (${width}px)`);

    const ext = mimeType.split("/")[1].replace("jpeg", "jpg");
    const tempPath = path.join(process.cwd(), `temp_${videoId}.${ext}`);
    fs.writeFileSync(tempPath, buffer);

    console.log(`📤 Uploading thumbnail for ${videoId}...`);
    const res = await youtube.thumbnails.set({
      videoId,
      media: {
        mimeType,
        body: fs.createReadStream(tempPath),
      },
    });

    fs.unlinkSync(tempPath);
    console.log(`✅ Thumbnail updated for video ${videoId}`);
    return true;
  } catch (err) {
    if (err.message.includes("quota")) {
      console.warn("⚠️ Quota exceeded, pausing rotations temporarily.");
    } else {
      console.error(`❌ Thumbnail rotation failed: ${err.message}`);
    }
    return false;
  }
}

// -------------------------------------------------
// 4️⃣ Main logic: process active tests only
// -------------------------------------------------
async function processABTests() {
  console.log("🔍 Checking active A/B tests...");
  const now = DateTime.now().setZone("America/Los_Angeles");

  const { data: tests, error } = await supabase
    .from("ab_tests")
    .select("*")
    .eq("analytics_collected", false); // skip ended tests

  if (error) {
    console.error("❌ Error fetching tests:", error);
    return;
  }

  for (const test of tests) {
    const {
      id,
      video_id,
      thumbnail_urls,
      start_datetime,
      end_datetime,
      rotation_interval_value,
      rotation_interval_unit,
      last_rotation_time,
      current_index = 0,
      user_email,
    } = test;

    const start = DateTime.fromISO(start_datetime).setZone("America/Los_Angeles");
    const end = DateTime.fromISO(end_datetime).setZone("America/Los_Angeles");
    const lastRotation = last_rotation_time
      ? DateTime.fromISO(last_rotation_time).setZone("America/Los_Angeles")
      : null;

    if (now < start) {
      console.log(`⏳ Test ${id} not started yet (starts ${start.toISO()})`);
      continue;
    }
    if (now > end) {
      console.log(`🛑 Test ${id} ended (ended ${end.toISO()})`);
      continue;
    }

    const intervalMs = getIntervalMs(rotation_interval_value, rotation_interval_unit);
    const nextRotation = lastRotation
      ? lastRotation.plus({ milliseconds: intervalMs })
      : start;

    if (!lastRotation || now >= nextRotation) {
      console.log(`🔄 Rotating thumbnail for video ${video_id} (test ${id})...`);

      if (!thumbnail_urls || thumbnail_urls.length === 0) {
        console.warn(`⚠️ No thumbnails provided for test ${id}`);
        continue;
      }

      const oauth2Client = await getOAuth2ClientForUser(user_email);
      if (!oauth2Client) {
        console.warn(`⚠️ Skipping test ${id}: missing OAuth credentials`);
        continue;
      }

      const nextIndex = (current_index + 1) % thumbnail_urls.length;
      const nextThumbnail = thumbnail_urls[nextIndex];
      const success = await rotateThumbnail(video_id, nextThumbnail, oauth2Client);

      if (success) {
        const updateTime = now.toISO();

        const { error: updateError } = await supabase
          .from("ab_tests")
          .update({
            current_index: nextIndex,
            last_rotation_time: updateTime,
          })
          .eq("id", id);

        if (updateError) {
          console.error(`❌ Failed to update rotation state for test ${id}:`, updateError);
        } else {
          const nextTime = now.plus({ milliseconds: intervalMs }).toISO();
          console.log(`✅ Rotation complete for test ${id}. Next rotation at ${nextTime}`);
        }
      }
    } else {
      console.log(
        `⏰ Skipping test ${id} — next rotation at ${nextRotation.toISO()}`
      );
    }
  }
}

// -------------------------------------------------
// 5️⃣ Schedule runner (every 1 minute)
// -------------------------------------------------
cron.schedule("* * * * *", async () => {
  try {
    await processABTests();
  } catch (err) {
    console.error("❌ Scheduler run failed:", err);
  }
});
