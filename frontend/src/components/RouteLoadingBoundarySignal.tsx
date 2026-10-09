"use client";

import { useEffect } from "react";
import { setServerRouteLoading } from "@/lib/route-loading";

/** Mounted by route `loading.tsx` — tells NavigationLoading when the server boundary is active. */
export function RouteLoadingBoundarySignal() {
  useEffect(() => {
    setServerRouteLoading(true);
    return () => setServerRouteLoading(false);
  }, []);
  return null;
}
