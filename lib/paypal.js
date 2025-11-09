import axios from "axios";

// ✅ Auto-detect Sandbox vs Live from CLIENT ID prefix:
// Sandbox IDs start with "A"
// Live IDs start with "B"
export const PAYPAL_API_BASE = process.env.PAYPAL_CLIENT_ID?.startsWith("A")
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

// ✅ Create an OAuth access token
export async function paypalAccessToken() {
  try {
    const params = new URLSearchParams({ grant_type: "client_credentials" });

    const { data } = await axios.post(
      `${PAYPAL_API_BASE}/v1/oauth2/token`,
      params,
      {
        auth: {
          username: process.env.PAYPAL_CLIENT_ID,
          password: process.env.PAYPAL_CLIENT_SECRET,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return data.access_token;
  } catch (err) {
    console.error("❌ PayPal Access Token Error:", err?.response?.data || err);
    throw new Error("PayPal token error");
  }
}

// ✅ Create a subscription
export async function paypalCreateSubscription() {
  try {
    const token = await paypalAccessToken();

    const { data } = await axios.post(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions`,
      {
        plan_id: process.env.PAYPAL_PLAN_ID,
        application_context: {
          brand_name: "ThumbFlip",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${process.env.NEXT_PUBLIC_APP_ORIGIN}/billing/success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_ORIGIN}/billing/cancel`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return data;
  } catch (err) {
    console.error("❌ PayPal create-subscription Error:", err?.response?.data || err);
    throw new Error("PayPal subscription creation error");
  }
}

// ✅ Fetch subscription details
export async function paypalGetSubscription(subscriptionId) {
  try {
    const token = await paypalAccessToken();

    const { data } = await axios.get(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return data;
  } catch (err) {
    console.error("❌ PayPal get-subscription Error:", err?.response?.data || err);
    throw new Error("PayPal subscription fetch error");
  }
}
