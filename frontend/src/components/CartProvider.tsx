"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchCartAction, syncCartAction } from "@/lib/actions";
import {
  cartCount,
  cartFingerprint,
  cartSubtotal,
  consumeClearCartFlag,
  fromRemote,
  keepLineDetails,
  loadCart,
  mergeCarts,
  quantityInCart,
  saveCart,
  setLineQuantity,
  toSyncPayload,
  upsertLine,
  type AddItemResult,
  type CartLine,
} from "@/lib/cart-store";

type CartContextValue = {
  items: CartLine[];
  count: number;
  subtotal: string;
  quantityOf: (variantId: number) => number;
  addItem: (line: Omit<CartLine, "quantity"> & { quantity?: number }) => AddItemResult;
  setQuantity: (variantId: number, quantity: number, onHand?: number | null) => void;
  removeItem: (variantId: number) => void;
  flush: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [items, setItems] = useState<CartLine[]>([]);
  const itemsRef = useRef(items);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrating = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const persist = useCallback((next: CartLine[]) => {
    itemsRef.current = next;
    setItems(next);
    saveCart(next);
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const payload = toSyncPayload(itemsRef.current);
    const result = await syncCartAction(payload);
    if (result.status === 401) return;
    if (result.ok && result.data) {
      persist(keepLineDetails(itemsRef.current, fromRemote(result.data)));
    }
  }, [persist]);

  const scheduleFlush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, 1600);
  }, [flush]);

  useEffect(() => {
    const local = loadCart();
    persist(local);
    if (pathname.startsWith("/orders/") && consumeClearCartFlag()) {
      persist([]);
      return;
    }
    if (hydrating.current) return;
    hydrating.current = true;
    void (async () => {
      const remote = await fetchCartAction();
      hydrating.current = false;
      if (!remote.ok || remote.status === 401 || !remote.data) {
        return;
      }
      const merged = mergeCarts(itemsRef.current, fromRemote(remote.data));
      persist(merged);
      if (cartFingerprint(merged) !== cartFingerprint(fromRemote(remote.data))) {
        await syncCartAction(toSyncPayload(merged));
      }
    })();
  }, [pathname, persist]);

  const addItem = useCallback(
    (line: Omit<CartLine, "quantity"> & { quantity?: number }) => {
      const { lines, result } = upsertLine(itemsRef.current, { ...line, quantity: line.quantity ?? 1 });
      persist(lines);
      if (result.ok) scheduleFlush();
      return result;
    },
    [persist, scheduleFlush],
  );

  const setQuantity = useCallback(
    (variantId: number, quantity: number, onHand?: number | null) => {
      persist(setLineQuantity(itemsRef.current, variantId, quantity, onHand));
      scheduleFlush();
    },
    [persist, scheduleFlush],
  );

  const removeItem = useCallback(
    (variantId: number) => {
      persist(itemsRef.current.filter((line) => line.variant_id !== variantId));
      scheduleFlush();
    },
    [persist, scheduleFlush],
  );

  const quantityOf = useCallback((variantId: number) => quantityInCart(items, variantId), [items]);

  const value = useMemo(
    () => ({
      items,
      count: cartCount(items),
      subtotal: cartSubtotal(items),
      quantityOf,
      addItem,
      setQuantity,
      removeItem,
      flush,
    }),
    [items, quantityOf, addItem, setQuantity, removeItem, flush],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
