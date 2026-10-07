"use client";

import { createContext, useContext } from "react";
import type { CheckoutAddress } from "@/lib/checkout";

type CheckoutSelectionContextValue = {
  setSelectedAddress: (address: CheckoutAddress | null) => void;
};

const CheckoutSelectionContext = createContext<CheckoutSelectionContextValue | null>(null);

export function CheckoutSelectionProvider({
  setSelectedAddress,
  children,
}: {
  setSelectedAddress: (address: CheckoutAddress | null) => void;
  children: React.ReactNode;
}) {
  return (
    <CheckoutSelectionContext.Provider value={{ setSelectedAddress }}>
      {children}
    </CheckoutSelectionContext.Provider>
  );
}

export function useCheckoutSelection() {
  const ctx = useContext(CheckoutSelectionContext);
  if (!ctx) throw new Error("useCheckoutSelection must be used within CheckoutSelectionProvider");
  return ctx;
}
