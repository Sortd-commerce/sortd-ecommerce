"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";

export function PromoCarousel({ children }: { children: React.ReactNode }) {
  const visible = Children.toArray(children).filter(Boolean);
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const syncActive = useCallback(() => {
    const node = scroller.current;
    if (!node || visible.length < 2) return;
    const width = node.clientWidth;
    if (width < 1) return;
    const index = Math.round(node.scrollLeft / width);
    setActive(Math.max(0, Math.min(index, visible.length - 1)));
  }, [visible.length]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    syncActive();
    node.addEventListener("scroll", syncActive, { passive: true });
    return () => node.removeEventListener("scroll", syncActive);
  }, [syncActive]);

  function goTo(index: number) {
    const node = scroller.current;
    if (!node) return;
    node.scrollTo({ left: index * node.clientWidth, behavior: "smooth" });
    setActive(index);
  }

  if (!visible.length) return null;

  return (
    <div className="promo-carousel">
      <div ref={scroller} className="promo-carousel__track">
        {visible.map((slide, index) => (
          <div key={index} className="promo-carousel__slide">
            {slide}
          </div>
        ))}
      </div>
      {visible.length > 1 ? (
        <div className="promo-carousel__dots" role="tablist" aria-label="Promo banners">
          {visible.map((_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              className={index === active ? "promo-dot promo-dot--on" : "promo-dot"}
              aria-label={`Promo banner ${index + 1}`}
              aria-selected={index === active}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
