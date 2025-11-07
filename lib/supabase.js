import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load env manually (important for serverCron.js)
//dotenv.config();
dotenv.config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
