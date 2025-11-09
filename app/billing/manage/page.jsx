"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ManageSubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(null);
  const router = useRouter();

  async function loadSubscription() {
    try {
      setLoading(true);
      const res = await fetch("/api/billing/status", {
        cache: "no-store",
        credentials: "include",
      });

      const json = await res.json();
      setSub(json);
    } catch (err) {
      console.error("Failed to load subscription:", err);
      setSub(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubscription();
  }, []);

  async function cancelSubscription() {
    if (!confirm("Are you sure you want to cancel your subscription?")) return;

    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        credentials: "include",
      });

      const json = await res.json();

      if (json.success) {
        alert("Subscription canceled successfully.");
        router.push("/dashboard");
      } else {
        console.error(json);
        alert("Failed to cancel subscription. Please contact support.");
      }
    } catch (err) {
      console.error("Cancel error:", err);
      alert("Error contacting server.");
    }
  }

  // ----------------------------------------
  // ✅ Loading state
  // ----------------------------------------
  if (loading) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-xl font-bold">Loading subscription...</h1>
      </div>
    );
  }

  // ----------------------------------------
  // ✅ No subscription
  // ----------------------------------------
  if (!sub?.subscribed) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-xl font-bold mb-4">No Active Subscription</h1>

        <button
          onClick={() => router.push("/dashboard")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ----------------------------------------
  // ✅ Active subscription view (Razorpay or PayPal)
  // ----------------------------------------
  return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Manage Subscription</h1>

      <div className="border rounded-lg p-6 bg-white shadow">
        <p className="text-gray-700 mb-3">
          <strong>Status:</strong> Active ✅
        </p>

        <p className="text-gray-700 mb-3">
          <strong>Provider:</strong> {sub.provider?.toUpperCase() || "Unknown"}
        </p>

        {sub.provider === "razorpay" && (
          <p className="text-gray-700 mb-3 break-all">
            <strong>Razorpay Subscription ID:</strong>
            <br />
            {sub.razorpay_subscription_id}
          </p>
        )}

        {sub.provider === "paypal" && (
          <p className="text-gray-700 mb-3 break-all">
            <strong>PayPal Subscription ID:</strong>
            <br />
            {sub.paypal_subscription_id}
          </p>
        )}

        <button
          onClick={cancelSubscription}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded mt-4"
        >
          Cancel Subscription
        </button>

        <button
          onClick={() => router.push("/dashboard")}
          className="ml-3 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
