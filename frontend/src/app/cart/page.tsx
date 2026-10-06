"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBasket } from "@/components/BasketProvider";

export default function CartPage() {
  const router = useRouter();
  const { openBasket } = useBasket();

  useEffect(() => {
    openBasket();
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/");
  }, [openBasket, router]);

  return null;
}
