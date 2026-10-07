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
  ready: boolean;
  quantityOf: (variantId: number) => number;
  addItem: (line: Omit<CartLine, "quantity"> & { quantity?: number }) => AddItemResult;
  setQuantity: (variantId: number, quantity: number, onHand?: number | null) => void;
  removeItem: (variantId: number) => void;
  clearCart: () => void;
  flush: () => Promise<{ ok: boolean; message?: string }>;
};

const CartContext = createContext<CartContextValue | null>(null);

type SyncResult = { ok: boolean; message?: string; stale?: boolean };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const itemsRef = useRef(items);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localRevision = useRef(0);
  const scheduleFlushRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const persistLocal = useCallback((next: CartLine[]) => {
    itemsRef.current = next;
    setItems(next);
    saveCart(next);
  }, []);

  const bumpRevision = useCallback(() => {
    localRevision.current += 1;
  }, []);

  const applySyncResult = useCallback(
    (result: Awaited<ReturnType<typeof syncCartAction>>, baseLines: CartLine[]) => {
      let next = baseLines;
      if (result.skipped?.length) {
        const skipped = new Set(result.skipped);
        next = next.filter((line) => !skipped.has(line.variant_id));
      }
      if (result.data) {
        next = keepLineDetails(next, fromRemote(result.data));
      }
      persistLocal(next);
      if (result.skipped?.length) {
        return {
          ok: false as const,
          message: "Some items in your basket are no longer available and were removed.",
        };
      }
      return { ok: true as const };
    },
    [persistLocal],
  );

  const runSync = useCallback(
    async (revisionAtStart: number): Promise<SyncResult> => {
      const payload = toSyncPayload(itemsRef.current);
      const sentFingerprint = cartFingerprint(itemsRef.current);
      const result = await syncCartAction(payload);
      if (result.status === 401) return { ok: true };

      const localChanged =
        revisionAtStart !== localRevision.current ||
        cartFingerprint(itemsRef.current) !== sentFingerprint;
      if (localChanged) {
        scheduleFlushRef.current?.();
        return { ok: true, stale: true };
      }

      if (!result.ok) {
        return { ok: false, message: result.message || "Could not update your basket." };
      }
      return applySyncResult(result, itemsRef.current);
    },
    [applySyncResult],
  );

  const scheduleFlush = useCallback(() => {
    if (!ready) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void runSync(localRevision.current);
    }, 1600);
  }, [ready, runSync]);

  scheduleFlushRef.current = scheduleFlush;

  const flush = useCallback(async () => {
    if (!ready) return { ok: true };
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    let last: SyncResult = { ok: true };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const revisionAtStart = localRevision.current;
      last = await runSync(revisionAtStart);
      if (!last.ok || revisionAtStart === localRevision.current) {
        return last;
      }
    }
    return last;
  }, [ready, runSync]);

  const clearCart = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    bumpRevision();
    persistLocal([]);
    scheduleFlush();
  }, [bumpRevision, persistLocal, scheduleFlush]);

  useEffect(() => {
    setReady(false);
    const mountRevision = localRevision.current;
    const local = loadCart();
    persistLocal(local);
    setReady(true);

    if (pathname.startsWith("/orders/") && consumeClearCartFlag()) {
      clearCart();
      return;
    }

    let cancelled = false;
    void (async () => {
      const remote = await fetchCartAction();
      if (cancelled || mountRevision !== localRevision.current) return;
      if (!remote.ok || remote.status === 401 || !remote.data) {
        return;
      }
      const merged = mergeCarts(itemsRef.current, fromRemote(remote.data));
      if (mountRevision !== localRevision.current) return;
      persistLocal(merged);
      if (cartFingerprint(merged) !== cartFingerprint(fromRemote(remote.data))) {
        const revisionAtPush = localRevision.current;
        const result = await syncCartAction(toSyncPayload(merged));
        if (revisionAtPush !== localRevision.current) return;
        if (result.ok && result.data) {
          applySyncResult(
            { ok: true, status: 200, message: "", data: result.data, skipped: result.data.skipped_variant_ids },
            itemsRef.current,
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, persistLocal, clearCart, applySyncResult]);

  const addItem = useCallback(
    (line: Omit<CartLine, "quantity"> & { quantity?: number }) => {
      const { lines, result } = upsertLine(itemsRef.current, { ...line, quantity: line.quantity ?? 1 });
      bumpRevision();
      persistLocal(lines);
      if (result.ok) scheduleFlush();
      return result;
    },
    [bumpRevision, persistLocal, scheduleFlush],
  );

  const setQuantity = useCallback(
    (variantId: number, quantity: number, onHand?: number | null) => {
      bumpRevision();
      persistLocal(setLineQuantity(itemsRef.current, variantId, quantity, onHand));
      scheduleFlush();
    },
    [bumpRevision, persistLocal, scheduleFlush],
  );

  const removeItem = useCallback(
    (variantId: number) => {
      bumpRevision();
      persistLocal(itemsRef.current.filter((line) => line.variant_id !== variantId));
      scheduleFlush();
    },
    [bumpRevision, persistLocal, scheduleFlush],
  );

  const quantityOf = useCallback((variantId: number) => quantityInCart(items, variantId), [items]);

  const value = useMemo(
    () => ({
      items,
      count: cartCount(items),
      subtotal: cartSubtotal(items),
      ready,
      quantityOf,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      flush,
    }),
    [items, ready, quantityOf, addItem, setQuantity, removeItem, clearCart, flush],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
