import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

export async function GET() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "unauthenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("subscriptions")
    .select("status, razorpay_subscription_id, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    status: data?.status ?? "inactive",
    subscriptionId: data?.razorpay_subscription_id ?? null,
    current_period_end: data?.current_period_end ?? null
  });
}
