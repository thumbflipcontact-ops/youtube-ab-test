import Razorpay from "razorpay";

export async function POST() {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const subscription = await razorpay.subscriptions.create({
    plan_id: "plan_JXArkeFsA8T123",
    customer_notify: 1,
    quantity: 1,
    total_count: 12,
  });

  return Response.json({ subscriptionId: subscription.id });
}
