import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { paypalCreateSubscription } from "../../../../lib/paypal";
import { getUserIdFromSession } from "../../../../lib/userIdFromSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // ✅ Get logged-in user
    const { userId } = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Check if already subscribed via PayPal
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("status, provider, paypal_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.status === "active" && existing?.provider === "paypal") {
      return NextResponse.json({
        already_active: true,
        redirect: null,
        subscriptionId: existing.paypal_subscription_id,
      });
    }

    // ✅ Create PayPal subscription
    const sub = await paypalCreateSubscription();

    if (!sub || !sub.links) {
      console.error("❌ Invalid PayPal subscription response:", sub);
      return NextResponse.json(
        { error: "Failed to create PayPal subscription" },
        { status: 500 }
      );
    }

    const approvalLink = sub.links.find((l) => l.rel === "approve")?.href;

    if (!approvalLink) {
      console.error("❌ Missing PayPal approval link:", sub);
      return NextResponse.json(
        { error: "Missing PayPal approval URL" },
        { status: 500 }
      );
    }

    // ✅ Save "inactive" subscription until webhook confirms
    await supabaseAdmin.from("subscriptions").upsert({
      user_id: userId,
      provider: "paypal",
      plan_id: process.env.PAYPAL_PLAN_ID,
      paypal_subscription_id: sub.id,
      status: "inactive",
    });

    return NextResponse.json({
      redirect: approvalLink,
      subscriptionId: sub.id,
    });
  } catch (err) {
    console.error("❌ PayPal create-subscription error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
