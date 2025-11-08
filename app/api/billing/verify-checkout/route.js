import { supabase } from "../../../../lib/supabaseClient";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/authOptions";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import crypto from "crypto";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email;
    const body = await req.json();

    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
    } = body;

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required Razorpay fields" },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    const dataToSign =
      razorpay_payment_id + "|" + razorpay_subscription_id;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(dataToSign)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error("❌ Signature mismatch in verify-checkout");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // ✅ Signature is valid — mark subscription active
    await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "active",
      })
      .eq("user_email", userEmail);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Error in verify-checkout:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
