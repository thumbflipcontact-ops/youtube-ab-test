import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature");
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
  if (expected !== sig) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  const evt = JSON.parse(raw);
  const subId = evt?.payload?.subscription?.entity?.id || evt?.payload?.payment?.entity?.subscription_id;
  if (!subId) return NextResponse.json({ received: true });

  let status = null;
  switch (evt.event) {
    case "subscription.activated":
    case "subscription.charged":
    case "invoice.paid":
      status = "active"; break;
    case "subscription.paused":
      status = "paused"; break;
    case "payment.failed":
      status = "past_due"; break;
    case "subscription.cancelled":
    case "subscription.halted":
      status = "canceled"; break;
  }
  if (status) {
    await supabaseAdmin.from("subscriptions")
      .update({ status, provider: "razorpay" })
      .eq("razorpay_subscription_id", subId);
  }
  return NextResponse.json({ received: true });
}
