export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/authOptions";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import Razorpay from "razorpay";

// ✅ Auto-detect PayPal sandbox vs live
const PAYPAL_API_BASE =
  process.env.PAYPAL_CLIENT_ID?.startsWith("A") // sandbox IDs start with A
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

// ✅ Function to get PayPal access token
async function paypalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const json = await res.json();
  return json.access_token;
}

export async function POST() {
  try {
    // ✅ authenticate user
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Fetch user subscription
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!sub) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 400 }
      );
    }

    // ✅ Razorpay cancellation
    if (sub.provider === "razorpay") {
      try {
        const rz = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        await rz.subscriptions.cancel(sub.razorpay_subscription_id);

        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        return NextResponse.json({ success: true, provider: "razorpay" });
      } catch (err) {
        console.error("❌ Razorpay cancel error:", err);
        return NextResponse.json(
          { error: "Razorpay cancellation failed" },
          { status: 500 }
        );
      }
    }

    // ✅ PayPal cancellation
    if (sub.provider === "paypal") {
      try {
        const token = await paypalAccessToken();

        const res = await fetch(
          `${PAYPAL_API_BASE}/v1/billing/subscriptions/${sub.paypal_subscription_id}/cancel`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reason: "User cancelled subscription",
            }),
          }
        );

        if (!res.ok) throw new Error("PayPal API error");

        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        return NextResponse.json({ success: true, provider: "paypal" });
      } catch (err) {
        console.error("❌ PayPal cancel error:", err);
        return NextResponse.json(
          { error: "PayPal cancellation failed" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  } catch (err) {
    console.error("❌ Cancel API error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
