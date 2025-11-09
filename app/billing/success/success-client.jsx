"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function BillingSuccessClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    async function finalize() {
      // ✅ PayPal returns subscription_id in the URL
      const paypalSubId = searchParams.get("subscription_id");

      if (paypalSubId) {
        const verify = await fetch("/api/paypal/verify", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription_id: paypalSubId }),
        });

        if (verify.ok) {
          router.replace("/dashboard");
        } else {
          alert("PayPal verification failed. Please contact support.");
          router.replace("/billing/cancel");
        }
        return;
      }

      // ✅ Razorpay flow ("resumeAfterSubscribe")
      if (localStorage.getItem("resumeAfterSubscribe") === "1") {
        localStorage.removeItem("resumeAfterSubscribe");
        router.replace("/dashboard");
        return;
      }

      // ✅ If user hits this page manually → send to dashboard
      router.replace("/dashboard");
    }

    finalize();
  }, [searchParams, router]);

  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold mb-2">Finalizing your subscription…</h1>
      <p className="text-gray-600">Please wait a moment.</p>
    </div>
  );
}
