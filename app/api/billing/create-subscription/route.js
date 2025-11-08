export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getRazorpay } from "../../../../lib/razorpay";
import { authOptions } from "../../auth/authOptions";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const email = session.user.email;
    const razorpay = getRazorpay();

    // ✅ Check existing subscription
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("razorpay_subscription_id, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing && ["active", "past_due", "paused"].includes(existing.status)) {
      return NextResponse.json({
        subscriptionId: existing.razorpay_subscription_id,
        status: existing.status,
      });
    }

    // ✅ Create subscription — correct Razorpay format
    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_PLAN_ID,
      customer_notify: 1,
      quantity: 1,
      total_count: 0, // ✅ infinite recurring subscription
      notes: { email },
    });

    // ✅ Save to Supabase
    await supabaseAdmin
      .from("subscriptions")
      .upsert({
        user_id: userId,
        plan_id: process.env.RAZORPAY_PLAN_ID,
        razorpay_subscription_id: subscription.id,
        status: subscription.status ?? "created",
      });

    return NextResponse.json({ subscriptionId: subscription.id });
  } catch (error) {
    console.error("Razorpay Subscription Error:", error);
    return NextResponse.json(
      {
        error: "Failed to create subscription",
        details: error?.error?.description || error.message,
      },
      { status: 500 }
    );
  }
}
