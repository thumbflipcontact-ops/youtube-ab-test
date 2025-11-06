import nextConnect from "next-connect";
import multer from "multer";
import { supabase } from "../../lib/supabase";

export const config = {
  api: {
    bodyParser: false, // ❗ REQUIRED for multer
  },
};

// Multer stores files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max per file
  },
});

const apiRoute = nextConnect({
  onError(error, req, res) {
    console.error("❌ Upload API Error:", error);
    res.status(501).json({ error: `Upload error: ${error.message}` });
  },
  onNoMatch(req, res) {
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  },
});

// Accept multiple images
apiRoute.use(upload.array("files"));

apiRoute.post(async (req, res) => {
  try {
    const videoId = req.body.videoId;
    if (!videoId) {
      return res.status(400).json({ error: "Missing videoId" });
    }

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const uploadedUrls = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const extension = file.mimetype.split("/")[1];
      const filename = `uploads/${videoId}_${Date.now()}_${i}.${extension}`;

      console.log(`📤 Uploading ${filename} (${file.size} bytes)`);

      const { data, error } = await supabase.storage
        .from("thumbnails")
        .upload(filename, file.buffer, {
          contentType: file.mimetype,
        });

      if (error) {
        console.error("❌ Supabase upload error:", error);
        continue;
      }

      const { data: publicData } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(filename);

      const publicUrl = publicData.publicUrl;
      uploadedUrls.push(publicUrl);

      // Save metadata
      await supabase.from("thumbnails_meta").insert([
        { video_id: videoId, url: publicUrl },
      ]);

      console.log(`✅ Uploaded: ${publicUrl}`);
    }

    if (uploadedUrls.length === 0) {
      return res.status(500).json({ error: "Upload failed for all files" });
    }

    res.status(200).json({ urls: uploadedUrls });
  } catch (err) {
    console.error("❌ Upload Handler Error:", err);
    res.status(500).json({ error: "Server failed to upload files" });
  }
});

export default apiRoute;
