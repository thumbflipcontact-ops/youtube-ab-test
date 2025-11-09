"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function BillingSuccessClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    async function finalize() {
      const subscriptionId = searchParams.get("subscription_id");

      if (subscriptionId) {
        await fetch("/api/paypal/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription_id: subscriptionId }),
        });
      }

      localStorage.removeItem("resumeAfterSubscribe");
      router.replace("/dashboard");
    }

    finalize();
  }, [searchParams, router]);
}
