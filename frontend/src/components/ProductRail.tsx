"use client";

import { useRef } from "react";

export function ProductRail({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  return (
    <section id={id} className="aisle-section">
      <div className="aisle-head">
        <h2>{title}</h2>
        <div className="aisle-meta">
          <span className="aisle-count">
            {count} {count === 1 ? "product" : "products"}
          </span>
          <a href={`#${id}`} className="aisle-see-all">
            See all →
          </a>
          <button
            type="button"
            className="rail-nav"
            aria-label={`Previous in ${title}`}
            onClick={() => scroller.current?.scrollBy({ left: -320, behavior: "smooth" })}
          >
            ←
          </button>
          <button
            type="button"
            className="rail-nav"
            aria-label={`Next in ${title}`}
            onClick={() => scroller.current?.scrollBy({ left: 320, behavior: "smooth" })}
          >
            →
          </button>
        </div>
      </div>
      <div ref={scroller} className="product-rail">
        {children}
      </div>
    </section>
  );
}
