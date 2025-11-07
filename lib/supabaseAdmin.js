// lib/supabaseAdmin.js
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,  // URL is public anyway
  process.env.SUPABASE_SERVICE_ROLE_KEY      // NEVER public
);
