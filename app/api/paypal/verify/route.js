import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { paypalGetSubscription } from "../../../../lib/paypal";

export async function POST(req) {
  const { subscription_id } = await req.json();
  if (!subscription_id) return NextResponse.json({ error: "No subscription_id" }, { status: 400 });

  const sub = await paypalGetSubscription(subscription_id);
  if (sub?.status === "ACTIVE") {
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "active", provider: "paypal" })
      .eq("paypal_subscription_id", subscription_id);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Not active" }, { status: 400 });
}
