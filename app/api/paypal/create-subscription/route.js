import { NextResponse } from "next/server";
import { authOptions } from "../../auth/authOptions";
import { getUserIdFromSession } from "../../../../lib/userIdFromSession";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { paypalCreateSubscription } from "../../../../lib/paypal";

export async function POST() {
  const { userId } = await getUserIdFromSession(authOptions);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("status, provider, paypal_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.status === "active" && existing?.provider === "paypal") {
    return NextResponse.json({ already_active: true, redirect: null });
  }

  const sub = await paypalCreateSubscription();
  const approve = sub.links?.find(l => l.rel === "approve")?.href;

  await supabaseAdmin.from("subscriptions").upsert({
    user_id: userId,
    provider: "paypal",
    plan_id: process.env.PAYPAL_PLAN_ID,
    paypal_subscription_id: sub.id,
    status: "inactive",
  });

  return NextResponse.json({ redirect: approve, subscriptionId: sub.id });
}
