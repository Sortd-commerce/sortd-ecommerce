"use client";

import { useBasket } from "@/components/BasketProvider";

export function OpenBasketLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { openBasket } = useBasket();
  return (
    <button type="button" className={className} onClick={openBasket}>
      {children}
    </button>
  );
}
