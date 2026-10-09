"use client";

import { useSearchParams } from "next/navigation";
import { OrderSuccessCelebrate } from "@/components/OrderSuccessCelebrate";

export function OrderDetailClient() {
  const params = useSearchParams();
  const active = params.get("placed") === "1";
  return <OrderSuccessCelebrate active={active} />;
}
