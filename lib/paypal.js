import axios from "axios";
const BASE = "https://api-m.paypal.com"; // LIVE

export async function paypalAccessToken() {
  const params = new URLSearchParams({ grant_type: "client_credentials" });
  const { data } = await axios.post(`${BASE}/v1/oauth2/token`, params, {
    auth: { username: process.env.PAYPAL_CLIENT_ID, password: process.env.PAYPAL_CLIENT_SECRET },
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data.access_token;
}

export async function paypalCreateSubscription() {
  const token = await paypalAccessToken();
  const { data } = await axios.post(
    `${BASE}/v1/billing/subscriptions`,
    {
      plan_id: process.env.PAYPAL_PLAN_ID,
      application_context: {
        brand_name: "ThumbFlip",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${process.env.NEXT_PUBLIC_APP_ORIGIN}/billing/success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_ORIGIN}/billing/cancel`,
      },
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

export async function paypalGetSubscription(subId) {
  const token = await paypalAccessToken();
  const { data } = await axios.get(`${BASE}/v1/billing/subscriptions/${subId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
