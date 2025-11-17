import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";


const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE_KEY
);


export async function POST(req) {
try {
const body = await req.json();


const { name, email, channel, reason, testimonial } = body;


const { error } = await supabase.from("beta_signups").insert([
{ name, email, channel, reason, testimonial },
]);


if (error) {
return NextResponse.json({ error: error.message }, { status: 400 });
}


return NextResponse.json({ success: true }, { status: 200 });
} catch (err) {
return NextResponse.json({ error: err.message }, { status: 500 });
}
}