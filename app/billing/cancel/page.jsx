"use client";

import { useRouter } from "next/navigation";

export default function BillingCancelPage() {
  const router = useRouter();

  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold mb-2">Subscription Cancelled</h1>
      <p className="text-gray-600 mb-6">
        You did not complete the subscription process.
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
