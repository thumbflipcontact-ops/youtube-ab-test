import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { authOptions } from "../../auth/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ status: "unauthenticated" }, { status: 401 });
  }

  const email = session.user.email;

  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("status, razorpay_subscription_id, current_period_end")
    .eq("user_email", email)
    .maybeSingle();

  return NextResponse.json({
    status: data?.status ?? "inactive",
    subscriptionId: data?.razorpay_subscription_id ?? null,
    current_period_end: data?.current_period_end ?? null,
  });
}
