"use client";
import { useState, useEffect } from "react";

export function useSubscription() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("inactive");
  const [subscriptionId, setSubscriptionId] = useState(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch("/api/me/subscription", { cache: "no-store" });
        const json = await res.json();
        if (!active) return;

        setStatus(json.status);
        setSubscriptionId(json.subscriptionId);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false };
  }, []);

  return { loading, status, subscriptionId };
}
