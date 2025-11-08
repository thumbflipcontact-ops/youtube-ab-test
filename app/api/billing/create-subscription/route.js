import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getRazorpay } from "../../../../lib/razorpay";
import { authOptions } from "../../auth/authOptions";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  const razorpay = getRazorpay();

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("razorpay_subscription_id, status")
    .eq("user_email", email)
    .maybeSingle();

  if (existing && ["active", "past_due", "paused"].includes(existing.status)) {
    return NextResponse.json({
      subscriptionId: existing.razorpay_subscription_id,
      status: existing.status,
    });
  }

  const subscription = await razorpay.subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID,
    customer_notify: 1,
    quantity: 1,
    total_count: 0,
    currency: "USD",
    notes: { email },
  });

  await supabaseAdmin
    .from("subscriptions")
    .upsert({
      user_email: email,
      plan_id: process.env.RAZORPAY_PLAN_ID,
      razorpay_subscription_id: subscription.id,
      status: "inactive",
    });

  return NextResponse.json({ subscriptionId: subscription.id });
}
