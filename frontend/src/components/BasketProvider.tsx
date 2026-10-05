"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type BasketUi = {
  open: boolean;
  openBasket: () => void;
  closeBasket: () => void;
};

const BasketContext = createContext<BasketUi | null>(null);

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const openBasket = useCallback(() => setOpen(true), []);
  const closeBasket = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ open, openBasket, closeBasket }), [open, openBasket, closeBasket]);

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket() {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error("useBasket must be used within BasketProvider");
  return ctx;
}
