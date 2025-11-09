import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { paypalGetSubscription } from "../../../../lib/paypal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const subscription_id = body?.subscription_id;

    if (!subscription_id) {
      return NextResponse.json(
        { error: "Missing subscription_id" },
        { status: 400 }
      );
    }

    // ✅ Fetch latest subscription status from PayPal
    const sub = await paypalGetSubscription(subscription_id);

    if (!sub) {
      return NextResponse.json(
        { error: "PayPal returned no subscription" },
        { status: 500 }
      );
    }

    // ✅ Status must be ACTIVE to confirm
    if (sub.status === "ACTIVE") {
      await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "active",
          provider: "paypal",
        })
        .eq("paypal_subscription_id", subscription_id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: `Subscription not active – status = ${sub.status}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("❌ PayPal verify error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
