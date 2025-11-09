export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/authOptions";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import Razorpay from "razorpay";

export async function POST() {
  try {
    // ✅ Authenticate user via NextAuth session
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Look for existing subscription
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("status, provider, razorpay_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    // ✅ If user already has active subscription, skip checkout flow
    if (existing?.status === "active" && existing?.provider === "razorpay") {
      return NextResponse.json(
        {
          already_active: true,
          subscriptionId: existing.razorpay_subscription_id,
        },
        { status: 200 }
      );
    }

    // ✅ Initialize Razorpay instance
    const rz = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // ✅ Razorpay Test Mode only supports INR
    const currency = process.env.RAZORPAY_KEY_ID.startsWith("rzp_test_")
      ? "INR"
      : "USD";

    // ✅ Create subscription
    const subscription = await rz.subscriptions.create({
      plan_id: process.env.RAZORPAY_PLAN_ID,
      customer_notify: 1,
      quantity: 1,
      total_count: 0, // recurring until cancelled
      currency,       // INR in test mode / USD in live
      notes: { user_id: userId },
    });

    // ✅ Store/Update inside Supabase
    const { error: dbError } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          provider: "razorpay",
          razorpay_subscription_id: subscription.id,
          plan_id: process.env.RAZORPAY_PLAN_ID,
          status: "inactive", // will become "active" after webhook or verification
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" } // ensures only one subscription per user
      );

    if (dbError) {
      console.error("❌ Supabase upsert error:", dbError);
      return NextResponse.json(
        { error: "Database error saving subscription" },
        { status: 500 }
      );
    }

    // ✅ Return subscription ID to frontend
    return NextResponse.json(
      { subscriptionId: subscription.id },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Error in create-subscription:", err);
    return NextResponse.json(
      { error: "Server error", details: err.message },
      { status: 500 }
    );
  }
}
