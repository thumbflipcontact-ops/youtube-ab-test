import { NextResponse } from "next/server";
import { authOptions } from "../../auth/authOptions";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getUserIdFromSession } from "../../../../lib/userIdFromSession";
import { getRazorpay } from "../../../../lib/razorpay";
import { paypalAccessToken } from "../../../../lib/paypal";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await getUserIdFromSession(authOptions);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch current subscription
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({ error: "No subscription found" }, { status: 400 });
  }

  // ✅ Razorpay cancellation
  if (sub.provider === "razorpay") {
    try {
      const rz = getRazorpay();
      await rz.subscriptions.cancel(sub.razorpay_subscription_id);

      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", userId);

      return NextResponse.json({ success: true, provider: "razorpay" });
    } catch (err) {
      console.error("Razorpay cancel error:", err);
      return NextResponse.json({ error: "Razorpay cancellation failed" }, { status: 500 });
    }
  }

  // ✅ PayPal cancellation
  if (sub.provider === "paypal") {
    try {
      const token = await paypalAccessToken();
      const result = await fetch(
        `https://api-m.paypal.com/v1/billing/subscriptions/${sub.paypal_subscription_id}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "User requested cancellation" }),
        }
      );

      if (!result.ok) throw new Error("PayPal API error");

      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", userId);

      return NextResponse.json({ success: true, provider: "paypal" });
    } catch (err) {
      console.error("PayPal cancel error:", err);
      return NextResponse.json({ error: "PayPal cancellation failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
}
