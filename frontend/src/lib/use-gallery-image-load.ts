"use client";

import { useCallback, useEffect, useState } from "react";

export function useGalleryImageLoad(count: number, active: number) {
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set(count > 0 ? [0] : []));

  const markLoaded = useCallback((index: number) => {
    if (index < 0 || index >= count) return;
    setLoaded((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, [count]);

  useEffect(() => {
    if (count < 1) {
      setLoaded(new Set());
      return;
    }
    setLoaded((prev) => (prev.has(0) ? prev : new Set([0])));
  }, [count]);

  useEffect(() => {
    markLoaded(active);
    markLoaded(active - 1);
    markLoaded(active + 1);
  }, [active, markLoaded]);

  useEffect(() => {
    if (count < 2) return;

    let cancelled = false;
    const loadRest = () => {
      if (cancelled) return;
      setLoaded((prev) => {
        const next = new Set(prev);
        for (let i = 0; i < count; i++) next.add(i);
        return next;
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(loadRest, { timeout: 8000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(loadRest, 8000);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [count]);

  return { loaded, markLoaded };
}
