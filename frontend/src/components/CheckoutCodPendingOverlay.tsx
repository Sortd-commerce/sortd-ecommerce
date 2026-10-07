"use client";

import { useFormStatus } from "react-dom";
import { CheckoutProcessingOverlay } from "@/components/CheckoutProcessingOverlay";

export function CheckoutCodPendingOverlay() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <CheckoutProcessingOverlay message="Placing your order…" />;
}
