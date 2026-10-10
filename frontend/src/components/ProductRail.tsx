"use client";

import { useRef, useState } from "react";

export function ProductRail({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);

  return (
    <section id={id} className="aisle-section">
      <div className="aisle-head">
        <h2>{title}</h2>
        <div className="aisle-meta">
          <button type="button" className="aisle-see-all" aria-expanded={showAll} aria-controls={`${id}-products`} onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show less ←" : "See all →"}
          </button>
          {!showAll ? <><button type="button" className="rail-nav" aria-label={`Previous in ${title}`} onClick={() => scroller.current?.scrollBy({ left: -320, behavior: "smooth" })}>←</button><button type="button" className="rail-nav" aria-label={`Next in ${title}`} onClick={() => scroller.current?.scrollBy({ left: 320, behavior: "smooth" })}>→</button></> : null}
        </div>
      </div>
      <div id={`${id}-products`} ref={scroller} className={`product-rail${showAll ? " product-rail--grid" : ""}`}>
        {children}
      </div>
    </section>
  );
}
