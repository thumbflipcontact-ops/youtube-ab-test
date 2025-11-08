import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";
import { getRazorpay } from "../../../../lib/razorpay";

export async function POST() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check existing record
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("razorpay_subscription_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing && ["active", "past_due", "paused"].includes(existing.status)) {
    return NextResponse.json({
      subscriptionId: existing.razorpay_subscription_id,
      status: existing.status
    });
  }

  const razorpay = getRazorpay();

  const subscription = await razorpay.subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID,
    customer_notify: 1,
    quantity: 1,
    total_count: 0,
    currency: "USD",
    notes: { user_id: user.id }
  });

  await supabase.from("subscriptions").upsert({
    user_id: user.id,
    plan_id: process.env.RAZORPAY_PLAN_ID,
    razorpay_subscription_id: subscription.id,
    status: "inactive"
  });

  return NextResponse.json({ subscriptionId: subscription.id });
}
