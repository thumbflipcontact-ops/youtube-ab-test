import { supabase } from "../../lib/supabase";

// Increase body parser limit for multiple large base64 images
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1gb", // adjust depending on max file count/size
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    console.warn("Method not allowed:", req.method);
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { files, videoId } = req.body; // files = array of base64 strings
    if (!files || !videoId) {
      console.warn("Missing files or videoId");
      return res.status(400).json({ message: "Missing files or videoId" });
    }

    const uploadedUrls = [];

    for (let i = 0; i < files.length; i++) {
      try {
        // Detect MIME type dynamically
        const mimeMatch = files[i].match(/^data:(image\/\w+);base64,/);
        if (!mimeMatch) throw new Error("Invalid file format");
        const mimeType = mimeMatch[1]; // "image/jpeg" or "image/png"
        const extension = mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1];

        const base64Data = files[i].replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        // Store in uploads/ folder
        const filename = `uploads/${videoId}_${Date.now()}_${i}.${extension}`;

        console.log(`[Upload] Uploading file: ${filename} (size: ${buffer.length} bytes)`);

        const { data, error } = await supabase.storage
          .from("thumbnails")
          .upload(filename, buffer, { contentType: mimeType });

        if (error) {
          console.error(`[Upload] Supabase upload error for ${filename}:`, error);
          throw error;
        }

        // Get public URL
        const { data: publicData, error: urlError } = supabase.storage
          .from("thumbnails")
          .getPublicUrl(filename);

        if (urlError) {
          console.error(`[Upload] Supabase public URL error for ${filename}:`, urlError);
          throw urlError;
        }

        const publicUrl = publicData.publicUrl;

        console.log(`[Upload] File uploaded successfully: ${publicUrl}`);
        uploadedUrls.push(publicUrl);

        // Insert into thumbnails_meta table
        const { error: dbError } = await supabase
          .from("thumbnails_meta")
          .insert([{ video_id: videoId, url: publicUrl }]);

        if (dbError) {
          console.error(`[Upload] Failed to insert metadata for ${filename}:`, dbError);
        } else {
          console.log(`[Upload] Metadata saved for ${filename}`);
        }

      } catch (fileError) {
        console.error(`[Upload] Failed to upload file index ${i}:`, fileError);
      }
    }

    if (uploadedUrls.length === 0) {
      console.warn("[Upload] No files were uploaded successfully");
      return res.status(500).json({ message: "No files were uploaded. Check console for details." });
    }

    res.status(200).json({ urls: uploadedUrls });
  } catch (error) {
    console.error("[Upload] Handler error:", error);
    res.status(500).json({ message: "Upload failed. Check server console for details." });
  }
}


