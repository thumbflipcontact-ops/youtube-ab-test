import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const raw = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    // ✅ Verify Razorpay webhook signature
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(raw)
      .digest("hex");

    if (expected !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // ✅ Parse the webhook event
    const evt = JSON.parse(raw);
    const payload = evt?.payload || {};

    // ✅ Extract subscription id
    const subId =
      payload?.subscription?.entity?.id ||
      payload?.payment?.entity?.subscription_id;

    if (!subId) {
      return NextResponse.json({ received: true });
    }

    // ✅ Extract period details (important for renewals!)
    const subscriptionEntity = payload?.subscription?.entity;
    const periodStart = subscriptionEntity?.current_start
      ? new Date(subscriptionEntity.current_start * 1000).toISOString()
      : null;

    const periodEnd = subscriptionEntity?.current_end
      ? new Date(subscriptionEntity.current_end * 1000).toISOString()
      : null;

    // ✅ Map status
    let status = null;

    switch (evt.event) {
      case "subscription.activated":
      case "subscription.charged":
      case "invoice.paid":
        status = "active";
        break;

      case "subscription.paused":
        status = "paused";
        break;

      case "payment.failed":
        status = "past_due";
        break;

      case "subscription.cancelled":
      case "subscription.halted":
        status = "canceled";
        break;

      default:
        // unhandled event — ignore safely
        return NextResponse.json({ received: true });
    }

    // ✅ Build update
    const updateData = {
      status,
      provider: "razorpay",
      updated_at: new Date().toISOString(),
    };

    if (periodStart) updateData.current_period_start = periodStart;
    if (periodEnd) updateData.current_period_end = periodEnd;

    // ✅ Save to Supabase
    const { error: dbError } = await supabaseAdmin
      .from("subscriptions")
      .update(updateData)
      .eq("razorpay_subscription_id", subId);

    if (dbError) {
      console.error("❌ Supabase webhook update error:", dbError);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
