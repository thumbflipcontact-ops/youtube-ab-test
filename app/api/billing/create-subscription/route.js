export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getRazorpay } from "../../../../lib/razorpay";
import { authOptions } from "../../auth/authOptions";
import { getUserIdFromSession } from "../../../../lib/userIdFromSession";

export async function POST() {
  const { userId } = await getUserIdFromSession(authOptions);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("status, razorpay_subscription_id, provider")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.status === "active" && existing?.provider === "razorpay") {
    return NextResponse.json({ subscriptionId: existing.razorpay_subscription_id, already_active: true });
  }

  const rz = getRazorpay();
  const sub = await rz.subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID,
    customer_notify: 1,
    quantity: 1,
    total_count: 0,
    currency: "USD",
    notes: { user_id: userId },
  });

  await supabaseAdmin.from("subscriptions").upsert({
    user_id: userId,
    provider: "razorpay",
    plan_id: process.env.RAZORPAY_PLAN_ID,
    razorpay_subscription_id: sub.id,
    status: "inactive",
  });

  return NextResponse.json({ subscriptionId: sub.id });
}
