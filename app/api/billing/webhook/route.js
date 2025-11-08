import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("❌ Webhook signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    console.log("✅ Razorpay Webhook:", event.event);

    const subscriptionId =
      event?.payload?.subscription?.entity?.id ?? null;

    if (!subscriptionId) {
      console.warn("⚠️ Webhook received but missing subscription ID");
      return NextResponse.json({ received: true });
    }

    // ✅ Handle subscription events
    if (event.event === "subscription.activated") {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "active" })
        .eq("razorpay_subscription_id", subscriptionId);
    }

    if (event.event === "subscription.halted") {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "paused" })
        .eq("razorpay_subscription_id", subscriptionId);
    }

    if (event.event === "subscription.cancelled") {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("razorpay_subscription_id", subscriptionId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Error in Razorpay webhook:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
