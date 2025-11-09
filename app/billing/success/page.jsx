"use client";

import { Suspense } from "react";
import BillingSuccessClient from "./success-client";

export const dynamic = "force-dynamic"; // ✅ required

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center">
          <h1 className="text-2xl font-bold mb-2">Finalizing your subscription…</h1>
          <p className="text-gray-600">Please wait a moment.</p>
        </div>
      }
    >
      <BillingSuccessClient />
    </Suspense>
  );
}
