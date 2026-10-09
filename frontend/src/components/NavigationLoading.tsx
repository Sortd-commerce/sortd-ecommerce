"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RouteLoadingOverlay } from "@/components/RouteLoadingOverlay";
import { isHeavyRoute, routeLoadingMessage } from "@/lib/heavy-routes";
import {
  bindRouteLoadingStarter,
  isServerRouteLoading,
  onServerRouteLoadingEnd,
} from "@/lib/route-loading";

const MIN_VISIBLE_MS = 280;
const NO_BOUNDARY_MS = 200;
const MAX_VISIBLE_MS = 14_000;

function shouldHandleLink(anchor: HTMLAnchorElement, pathname: string, search: string): string | null {
  if (anchor.dataset.noRouteLoading !== undefined) return null;
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  const raw = anchor.getAttribute("href");
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return null;
  let url: URL;
  try {
    url = new URL(raw, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  const nextPath = url.pathname;
  const nextSearch = url.search;
  if (nextPath === pathname && nextSearch === search) return null;
  if (!isHeavyRoute(nextPath)) return null;
  return nextPath;
}

function NavigationLoadingInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const searchKey = search ? `?${search}` : "";

  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("Loading");
  const startedAt = useRef(0);
  const visibleRef = useRef(false);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  function begin(path: string) {
    startedAt.current = Date.now();
    setMessage(routeLoadingMessage(path));
    setVisible(true);
  }

  useEffect(() => {
    bindRouteLoadingStarter(begin);
    return () => bindRouteLoadingStarter(null);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const targetPath = shouldHandleLink(anchor, pathname, searchKey);
      if (!targetPath) return;
      begin(targetPath);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, searchKey]);

  useEffect(() => {
    if (!visibleRef.current) return;

    let cancelled = false;
    let unsubEnd: (() => void) | null = null;
    const timers: number[] = [];

    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      unsubEnd?.();
      timers.forEach((id) => window.clearTimeout(id));
      setVisible(false);
    };

    const afterMinVisible = (then: () => void) => {
      const elapsed = Date.now() - startedAt.current;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      timers.push(window.setTimeout(then, wait));
    };

    afterMinVisible(() => {
      if (cancelled) return;
      if (isServerRouteLoading()) {
        unsubEnd = onServerRouteLoadingEnd(() => {
          if (!cancelled) finish();
        });
        return;
      }
      finish();
    });

    timers.push(
      window.setTimeout(() => {
        if (cancelled || isServerRouteLoading()) return;
        finish();
      }, NO_BOUNDARY_MS),
    );

    timers.push(window.setTimeout(finish, MAX_VISIBLE_MS));

    return () => {
      cancelled = true;
      unsubEnd?.();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [pathname, searchKey]);

  if (!visible) return null;
  return <RouteLoadingOverlay message={message} />;
}

export function NavigationLoading() {
  return (
    <Suspense fallback={null}>
      <NavigationLoadingInner />
    </Suspense>
  );
}
