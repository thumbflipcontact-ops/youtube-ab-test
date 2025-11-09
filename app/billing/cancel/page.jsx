"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BillingCancelPage() {
  const router = useRouter();

  useEffect(() => {
    // ✅ If the user came here after canceling checkout,
    // clear any “resume after subscribe” flags.
    localStorage.removeItem("resumeAfterSubscribe");
  }, []);

  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold mb-2">Subscription Cancelled</h1>

      <p className="text-gray-600 mb-6">
        Your payment was not completed. You can try again anytime.
      </p>

      <button
        onClick={() => router.push("/dashboard")}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        Return to Dashboard
      </button>
    </div>
  );
}
