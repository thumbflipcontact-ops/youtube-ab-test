
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/authOptions";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { supabase } from "../../../../lib/supabaseClient";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { getUserIdFromSession } from "../../../../lib/userIdFromSession";

export async function POST(req) {
  const { userId } = await getUserIdFromSession(authOptions);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = await req.json();
  const sig = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_subscription_id}|${razorpay_payment_id}`).digest("hex");
  if (sig !== razorpay_signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await supabaseAdmin.from("subscriptions").upsert({
    user_id: userId,
    provider: "razorpay",
    status: "active",
    razorpay_subscription_id,
    plan_id: process.env.RAZORPAY_PLAN_ID,
  });

  return NextResponse.json({ success: true });
}
