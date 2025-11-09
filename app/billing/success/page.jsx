"use client";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import BillingSuccessClient from "./success-client";

export default function BillingSuccessPageWrapper() {
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
