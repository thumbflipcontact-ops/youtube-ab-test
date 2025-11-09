"use client";

import { useEffect, useState } from "react";

function loadRazorpayOnce() {
  if (typeof window === "undefined") return;
  if (document.getElementById("razorpay-checkout-js")) return;

  const script = document.createElement("script");
  script.id = "razorpay-checkout-js";
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.async = true;
  document.head.appendChild(script);
}

export default function PaywallUnified({ userCountry, onActivated }) {
  const [busy, setBusy] = useState(false);

  // ✅ Only load Razorpay script for India users
  useEffect(() => {
    if (userCountry === "IN") loadRazorpayOnce();
  }, [userCountry]);

  // ✅ Razorpay Flow (India)
  async function startRazorpay() {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/create-subscription", { method: "POST" });
      const data = await res.json();

      // Already subscribed (rare case)
      if (data.already_active) {
        onActivated?.();
        return;
      }

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: data.subscriptionId,
        name: "ThumbFlip",
        description: "Monthly Subscription",
        handler: async function (response) {
          try {
            const verify = await fetch("/api/billing/verify-checkout", {
              credentials: "include",
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });

            if (verify.ok) {
              onActivated?.();
            } else {
              alert("Verification failed. Please contact support.");
            }
          } catch (err) {
            console.error("Razorpay verification failed:", err);
            alert("Payment verification failed.");
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });

      rzp.open();
    } catch (err) {
      console.error("Razorpay error:", err);
      alert("Failed to initiate Razorpay payment.");
      setBusy(false);
    }
  }

  // ✅ PayPal Flow (International)
  async function startPayPal() {
    setBusy(true);

    try {
      const res = await fetch("/api/paypal/create-subscription", { method: "POST" });
      const data = await res.json();

      // Already subscribed fallback
      if (data.already_active) {
        onActivated?.();
        return;
      }

      // ✅ store a flag so we resume after redirect
      localStorage.setItem("resumeAfterSubscribe", "1");
      window.location.href = data.redirect; // PayPal approval URL
    } catch (err) {
      console.error("PayPal error:", err);
      alert("Failed to initiate PayPal payment.");
      setBusy(false);
    }
  }

  const startPayment = () => {
    if (userCountry === "IN") {
      return startRazorpay();
    } else {
      return startPayPal();
    }
  };

  return (
    <button
      onClick={startPayment}
      disabled={busy}
      className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded mt-3 disabled:opacity-50"
    >
      {busy ? "Opening checkout..." : "Subscribe to unlock"}
    </button>
  );
}
