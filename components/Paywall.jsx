"use client";
import { useCallback, useState } from "react";

// ✅ Load Razorpay script once
if (typeof window !== "undefined") {
  if (!document.getElementById("razorpay-checkout-js")) {
    const s = document.createElement("script");
    s.id = "razorpay-checkout-js";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.head.appendChild(s);
  }
}

export function PaywallButton({ children, onActivated }) {
  const [busy, setBusy] = useState(false);

  const startPayment = useCallback(async () => {
    setBusy(true);

    try {
      // ✅ 1. Create subscription
      const cs = await fetch("/api/billing/create-subscription", {
        method: "POST",
      });

      if (!cs.ok) {
        alert("Please sign in to continue.");
        setBusy(false);
        return;
      }

      const { subscriptionId } = await cs.json();

      // ✅ 2. Open Razorpay Checkout
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: subscriptionId,
        name: "Thumbnail Rotator",
        description: "Monthly Subscription",
        theme: { color: "#0ea5e9" },

        handler: async (response) => {
          // ✅ 3. Verify payment
          const verify = await fetch("/api/billing/verify-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });

          if (verify.ok) {
            // ✅ 4. Immediately continue your operation
            if (typeof onActivated === "function") {
              await onActivated();
            }
          } else {
            alert("Payment verification failed.");
          }
        },

        modal: {
          ondismiss: () => setBusy(false),
        },
      });

      rzp.open();
    } catch (e) {
      console.error(e);
      alert("Unable to start payment.");
      setBusy(false);
    }
  }, [onActivated]);

  return (
    <button
      disabled={busy}
      onClick={startPayment}
      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mt-3 disabled:opacity-50"
    >
      {busy ? "Opening payment…" : children}
    </button>
  );
}
