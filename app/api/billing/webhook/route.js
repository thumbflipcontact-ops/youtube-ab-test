import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(req) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(raw)
    .digest("hex");

  if (expected !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(raw);

  const type = event.event;

  async function setStatus(id, status) {
    await supabaseAdmin
      .from("subscriptions")
      .update({ status })
      .eq("razorpay_subscription_id", id);
  }

  if (type === "subscription.activated") {
    const s = event.payload.subscription.entity;
    await setStatus(s.id, "active");
  }

  if (type === "subscription.paused") {
    const s = event.payload.subscription.entity;
    await setStatus(s.id, "paused");
  }

  if (type === "subscription.halted" || type === "subscription.cancelled") {
    const s = event.payload.subscription.entity;
    await setStatus(s.id, "canceled");
  }

  if (type === "payment.failed") {
    const subId = event.payload.payment.entity.subscription_id;
    await setStatus(subId, "past_due");
  }

  return NextResponse.json({ received: true });
}

export const dynamic = "force-dynamic";
