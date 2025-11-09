"use client";

import { useEffect, useState } from "react";

// ✅ Safe loader with initialization guarantee
async function loadRazorpayScript() {
  if (typeof window === "undefined") return false;

  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);

    const existing = document.getElementById("razorpay-checkout-js");
    if (existing) {
      existing.onload = () => resolve(true);
      existing.onerror = () => resolve(false);
      return;
    }

    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("❌ Razorpay script failed to load");
      resolve(false);
    };

    document.head.appendChild(script);
  });
}

export default function PaywallUnified({ userCountry, onActivated }) {
  const [busy, setBusy] = useState(false);

  // ✅ Preload script only for India users
  useEffect(() => {
    if (userCountry === "IN") {
      loadRazorpayScript();
    }
  }, [userCountry]);

  // ----------------------------------------------------
  // ✅ Razorpay Flow (India)
  // ----------------------------------------------------
  async function startRazorpay() {
    setBusy(true);

    const scriptReady = await loadRazorpayScript();

    if (!scriptReady || typeof window.Razorpay === "undefined") {
      alert("Failed to load Razorpay. Please try again.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/billing/create-subscription", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (data.already_active) {
        onActivated?.();
        return;
      }

      if (!data.subscriptionId) {
        console.error("❌ Missing subscriptionId:", data);
        alert("Could not start subscription.");
        setBusy(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: data.subscriptionId,
        name: "ThumbFlip",
        description: "Monthly Subscription",
        handler: async (response) => {
          try {
            const verify = await fetch("/api/billing/verify-checkout", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });

            if (verify.ok) {
              onActivated?.();
            } else {
              const err = await verify.json().catch(() => ({}));
              console.error("❌ Verification failed:", err);
              alert("Verification failed. Contact support.");
            }
          } catch (err) {
            console.error("❌ Verification error:", err);
            alert("Verification error. Try again.");
          }
        },
        modal: {
          ondismiss: () => {
            console.log("Checkout dismissed");
            setBusy(false);
          },
        },
      });

      rzp.open();
    } catch (err) {
      console.error("❌ Razorpay start error:", err);
      alert("Failed to initiate Razorpay checkout.");
      setBusy(false);
    }
  }

  // ----------------------------------------------------
  // ✅ PayPal Flow (International)
  // ----------------------------------------------------
  async function startPayPal() {
    setBusy(true);

    try {
      const res = await fetch("/api/paypal/create-subscription", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (data.already_active) {
        onActivated?.();
        return;
      }

      if (!data.redirect) {
        alert("Unable to start PayPal checkout.");
        setBusy(false);
        return;
      }

      // ✅ Persist resume flag
      localStorage.setItem("resumeAfterSubscribe", "1");
      window.location.href = data.redirect;
    } catch (err) {
      console.error("❌ PayPal start error:", err);
      alert("Failed to initiate PayPal checkout.");
      setBusy(false);
    }
  }

  const startPayment = () => {
    if (busy) return;
    return userCountry === "IN" ? startRazorpay() : startPayPal();
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
