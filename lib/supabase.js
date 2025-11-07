// lib/supabase.js
"use server";

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load .env locally (Vercel ignores this and uses env vars automatically)
dotenv.config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Supabase env vars missing!");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
