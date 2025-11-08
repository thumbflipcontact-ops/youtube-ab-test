import crypto from "crypto";

export async function POST(req) {
  const body = await req.json();

  const generated = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.razorpay_subscription_id + "|" + body.razorpay_payment_id)
    .digest("hex");

  if (generated !== body.razorpay_signature) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Store to DB (for example in users table)
  // user.subscription_active = true
  // user.subscription_id = body.razorpay_subscription_id

  return Response.json({ success: true });
}
