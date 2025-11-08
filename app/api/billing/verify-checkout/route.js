import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "../../../lib/supabaseClient";

export async function POST(req) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = await req.json();

  const payload = `${razorpay_subscription_id}|${razorpay_payment_id}`;

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(payload)
    .digest("hex");

  if (expected !== razorpay_signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await supabase
    .from("subscriptions")
    .upsert({
      user_id: user.id,
      status: "active",
      razorpay_subscription_id
    });

  return NextResponse.json({ ok: true });
}
