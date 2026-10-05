"use client";

import { CaretRight } from "@phosphor-icons/react";
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
          <span>
            {count} {count === 1 ? "product" : "products"}
          </span>
          <button
            type="button"
            className="rail-next"
            aria-label={`More in ${title}`}
            onClick={() => scroller.current?.scrollBy({ left: 280, behavior: "smooth" })}
          >
            <CaretRight size={16} weight="bold" />
          </button>
        </div>
      </div>
      <div ref={scroller} className="product-rail">
        {children}
      </div>
    </section>
  );
}
