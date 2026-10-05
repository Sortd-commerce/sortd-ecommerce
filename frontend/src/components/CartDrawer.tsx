"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BasketView } from "@/components/BasketView";
import { useBasket } from "@/components/BasketProvider";

export function CartDrawer() {
  const pathname = usePathname();
  const { open, closeBasket } = useBasket();
  const visible = open && pathname !== "/cart" && !pathname.startsWith("/checkout");

  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeBasket();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, closeBasket]);

  if (!visible) return null;

  return (
    <div className="basket-layer">
      <button type="button" className="basket-scrim" aria-label="Close basket" onClick={closeBasket} />
      <aside className="basket-drawer" role="dialog" aria-modal="true" aria-label="Your basket">
        <BasketView onClose={closeBasket} />
      </aside>
    </div>
  );
}
