"use client";

import { useEffect } from "react";
import { LoadingSpinner } from "@/components/loading/StorefrontSkeletons";

export function CheckoutProcessingOverlay({ message }: { message: string }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="checkout-processing" role="alertdialog" aria-modal="true" aria-busy="true" aria-live="assertive">
      <div className="checkout-processing-card">
        <LoadingSpinner label={message} />
      </div>
    </div>
  );
}
