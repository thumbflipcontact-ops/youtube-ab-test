import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getRazorpay } from "../../../../lib/razorpay";
import { authOptions } from "../../auth/authOptions";
import { getUserIdFromSession } from "../../../../lib/userIdFromSession";

export async function GET() {
  const { userId } = await getUserIdFromSession(authOptions);
  if (!userId) return NextResponse.json({ subscribed: false });

  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("status, provider, razorpay_subscription_id, paypal_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  const subscribed = data?.status === "active";
  return NextResponse.json({
    subscribed,
    provider: data?.provider || null,
    razorpay_subscription_id: data?.razorpay_subscription_id || null,
    paypal_subscription_id: data?.paypal_subscription_id || null,
  });
}
