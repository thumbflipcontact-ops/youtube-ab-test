"use client";
export const dynamic = "force-dynamic";
export const ssr = false;

import BillingSuccessClient from "./success-client";

export default function BillingSuccessPage() {
  return <BillingSuccessClient />;
}
