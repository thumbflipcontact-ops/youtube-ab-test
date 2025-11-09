export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/authOptions";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import Razorpay from "razorpay";

export async function POST(req) {
  try {
    // ✅ MUST pass req for session to load
    const session = await getServerSession({ req }, authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // ✅ Check existing subscription
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("status, provider, razorpay_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.status === "active" && existing.provider === "razorpay") {
      return NextResponse.json({
        subscriptionId: existing.razorpay_subscription_id,
        already_active: true,
      });
    }

    // ✅ Create Razorpay subscription
    const rz = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const subscription = await rz.subscriptions.create({
      plan_id: process.env.RAZORPAY_PLAN_ID,
      quantity: 1,
      customer_notify: 1,
      total_count: 1,   // required for test mode
      notes: { user_id: userId },
    });

    // ✅ Save new subscription
    await supabaseAdmin.from("subscriptions").upsert({
      user_id: userId,
      provider: "razorpay",
      plan_id: process.env.RAZORPAY_PLAN_ID,
      razorpay_subscription_id: subscription.id,
      status: "inactive"
    });

    return NextResponse.json({ subscriptionId: subscription.id });

  } catch (err) {
    console.error("❌ Error in create-subscription:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
