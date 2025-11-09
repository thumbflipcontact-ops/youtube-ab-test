"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function BillingSuccessClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    async function handleSuccess() {
      const subscriptionId = searchParams.get("subscription_id");

      if (subscriptionId) {
        await fetch("/api/paypal/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription_id: subscriptionId }),
        });
      }

      const resume = localStorage.getItem("resumeAfterSubscribe");
      if (resume === "1") {
        localStorage.removeItem("resumeAfterSubscribe");
        router.replace("/dashboard");
      } else {
        router.replace("/dashboard");
      }
    }

    handleSuccess();
  }, [searchParams, router]);

  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold mb-2">Finalizing your subscription…</h1>
      <p className="text-gray-600">Please wait a moment.</p>
    </div>
  );
}
