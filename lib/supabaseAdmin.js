// lib/supabaseAdmin.js
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.supabase_url,  // URL is public anyway
  process.env.supabase_service_role      // NEVER public
);
