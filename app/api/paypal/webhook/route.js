import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(req) {
  const body = await req.json();
  const event = body?.event_type;

  const subId =
    body?.resource?.id ||
    body?.resource?.billing_agreement_id ||
    body?.resource?.subscription_id;

  if (!subId) return NextResponse.json({ received: true });

  let status = null;
  if (event === "BILLING.SUBSCRIPTION.ACTIVATED" || event === "PAYMENT.CAPTURE.COMPLETED") status = "active";
  if (event === "BILLING.SUBSCRIPTION.CANCELLED") status = "canceled";

  if (status) {
    await supabaseAdmin
      .from("subscriptions")
      .update({ status, provider: "paypal" })
      .eq("paypal_subscription_id", subId);
  }
  return NextResponse.json({ received: true });
}
