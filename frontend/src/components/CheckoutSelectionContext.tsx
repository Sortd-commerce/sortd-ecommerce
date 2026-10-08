"use client";

import { createContext, useContext, useState } from "react";
import type { CheckoutAddress } from "@/lib/checkout";

type CheckoutSelectionContextValue = {
  selectedAddress: CheckoutAddress | null;
  setSelectedAddress: (address: CheckoutAddress | null) => void;
};

const CheckoutSelectionContext = createContext<CheckoutSelectionContextValue | null>(null);

export function CheckoutSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedAddress, setSelectedAddress] = useState<CheckoutAddress | null>(null);
  return (
    <CheckoutSelectionContext.Provider value={{ selectedAddress, setSelectedAddress }}>
      {children}
    </CheckoutSelectionContext.Provider>
  );
}

export function useCheckoutSelection() {
  const ctx = useContext(CheckoutSelectionContext);
  if (!ctx) throw new Error("useCheckoutSelection must be used within CheckoutSelectionProvider");
  return ctx;
}
