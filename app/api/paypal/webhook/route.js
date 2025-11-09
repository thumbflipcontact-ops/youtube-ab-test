import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PayPal webhook verification steps:
 * 1. Read raw body
 * 2. Validate HMAC signature using Webhook ID
 * 3. Process event
 */

export async function POST(req) {
  try {
    // ✅ RAW BODY REQUIRED FOR SIGNATURE VALIDATION
    const rawBody = await req.text();

    const transmissionId = req.headers.get("paypal-transmission-id");
    const transmissionTime = req.headers.get("paypal-transmission-time");
    const certUrl = req.headers.get("paypal-cert-url");
    const authAlgo = req.headers.get("paypal-auth-algo");
    const transmissionSig = req.headers.get("paypal-transmission-sig");

    if (
      !transmissionId ||
      !transmissionTime ||
      !certUrl ||
      !authAlgo ||
      !transmissionSig
    ) {
      console.error("❌ Missing PayPal webhook headers");
      return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
    }

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      console.error("❌ PAYPAL_WEBHOOK_ID missing in .env");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    // ✅ Validate with PayPal API
    const validateRes = await fetch(
      `${process.env.PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
            ).toString("base64"),
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: JSON.parse(rawBody),
        }),
      }
    );

    const validation = await validateRes.json();

    if (validation.verification_status !== "SUCCESS") {
      console.error("❌ PayPal webhook verification failed:", validation);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // ✅ Webhook is verified — now parse body
    const evt = JSON.parse(rawBody);
    const event = evt?.event_type;

    // ✅ Extract subscription ID
    const subId =
      evt?.resource?.id ||
      evt?.resource?.subscription_id ||
      evt?.resource?.billing_agreement_id;

    if (!subId) {
      console.warn("⚠️ Webhook received but no subscription_id inside:", evt);
      return NextResponse.json({ received: true });
    }

    // ✅ Determine new subscription status
    let status = null;

    switch (event) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "PAYMENT.CAPTURE.COMPLETED":
        status = "active";
        break;

      case "BILLING.SUBSCRIPTION.CANCELLED":
        status = "canceled";
        break;

      case "BILLING.SUBSCRIPTION.SUSPENDED":
        status = "past_due";
        break;

      default:
        console.log("ℹ️ Unhandled PayPal event:", event);
    }

    // ✅ Update Supabase
    if (status) {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status, provider: "paypal" })
        .eq("paypal_subscription_id", subId);

      console.log(`✅ Updated subscription ${subId} → ${status}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("❌ PayPal Webhook Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
