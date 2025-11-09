export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { authOptions } from "../../auth/authOptions";

export async function GET() {
  try {
    // ✅ Use NextAuth for stable user identification
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { subscribed: false, provider: null },
        { status: 200 }
      );
    }

    // ✅ Look up subscription
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select(
        "status, provider, razorpay_subscription_id, paypal_subscription_id, current_period_end"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("❌ Subscription lookup error:", error);
      return NextResponse.json({ subscribed: false });
    }

    if (!data) {
      return NextResponse.json({ subscribed: false });
    }

    // ✅ Main logic
    const isActive = data.status === "active";

    // Optional: Block expired periods if you want strict behavior
    /*
    if (isActive && data.current_period_end) {
      const expired = new Date(data.current_period_end) < new Date();
      if (expired) {
        return NextResponse.json({ subscribed: false });
      }
    }
    */

    return NextResponse.json({
      subscribed: isActive,
      provider: data.provider || null,
      razorpay_subscription_id: data.razorpay_subscription_id || null,
      paypal_subscription_id: data.paypal_subscription_id || null,
    });
  } catch (err) {
    console.error("❌ status API error:", err);
    return NextResponse.json(
      { subscribed: false },
      { status: 500 }
    );
  }
}
