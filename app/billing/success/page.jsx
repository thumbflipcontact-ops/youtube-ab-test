"use client";
export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    async function finalize() {
      // ✅ PayPal returns subscription_id via GET params
      const paypalSubId = searchParams.get("subscription_id");

      if (paypalSubId) {
        const verify = await fetch("/api/paypal/verify", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription_id: paypalSubId }),
        });

        if (verify.ok) {
          router.push("/dashboard");
        } else {
          alert("PayPal verification failed.");
          router.push("/billing/cancel");
        }
        return;
      }

      // ✅ Fallback: Razorpay flow ("resumeAfterSubscribe")
      if (localStorage.getItem("resumeAfterSubscribe")) {
        localStorage.removeItem("resumeAfterSubscribe");
        router.push("/dashboard");
        return;
      }

      // ✅ Neither PayPal nor Razorpay – user arrived by mistake
      router.push("/dashboard");
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
