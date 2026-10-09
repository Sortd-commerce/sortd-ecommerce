"use client";

import { useEffect, useRef, useState } from "react";
import { OptimizedImage, type OptimizedImageProps } from "@/components/OptimizedImage";

type ViewportLazyImageProps = OptimizedImageProps & {
  root?: Element | null;
  rootMargin?: string;
  /** Load remaining assets when the browser is idle (after viewport loads). */
  eagerAfterIdle?: boolean;
  idleTimeoutMs?: number;
  wrapperClassName?: string;
};

export function ViewportLazyImage({
  root = null,
  rootMargin = "280px 0px",
  eagerAfterIdle = false,
  idleTimeoutMs = 6000,
  wrapperClassName = "",
  priority,
  fill,
  className,
  ...imageProps
}: ViewportLazyImageProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(Boolean(priority));

  useEffect(() => {
    if (visible) return;
    const node = wrapRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root, rootMargin, threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, root, rootMargin]);

  useEffect(() => {
    if (!eagerAfterIdle || visible) return;

    let cancelled = false;
    const reveal = () => {
      if (!cancelled) setVisible(true);
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(reveal, { timeout: idleTimeoutMs });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(reveal, idleTimeoutMs);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [eagerAfterIdle, idleTimeoutMs, visible]);

  const fillClass = fill ? " viewport-lazy-image--fill" : "";

  return (
    <span
      ref={wrapRef}
      className={`viewport-lazy-image${fillClass}${wrapperClassName ? ` ${wrapperClassName}` : ""}`}
    >
      {visible ? (
        <OptimizedImage {...imageProps} fill={fill} priority={priority} className={className} />
      ) : (
        <span className="viewport-lazy-image__shimmer" aria-hidden />
      )}
    </span>
  );
}
