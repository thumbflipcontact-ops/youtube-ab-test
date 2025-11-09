"use client";

export const dynamic = "force-dynamic"; // ✅ Disable prerender for this page only
export const revalidate = 0;            // ✅ No static generation
export const fetchCache = "force-no-store";

import { Suspense } from "react";
import BillingSuccessClient from "./success-client";

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="p-10 text-center">
        <h1 className="text-2xl font-bold mb-2">Finalizing your subscription…</h1>
        <p className="text-gray-600">Please wait…</p>
      </div>
    }>
      <BillingSuccessClient />
    </Suspense>
  );
}
