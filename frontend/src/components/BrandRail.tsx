"use client";

import { aisleTint } from "@/lib/tints";
import { OptimizedImage } from "@/components/OptimizedImage";
import Link from "next/link";
import { useRef, useState } from "react";

type BrandGroup = { brand: string; count: number; image_url?: string | null };

export function BrandRail({ brandGroups }: { brandGroups: BrandGroup[] }) {
  const [showAll, setShowAll] = useState(false);

  return (
    <section    
      className="home-section home-section--brands"
      aria-label="Shop by brand"
    >
      <div className="home-inner brand-picker">
        <div className="aisle-head">
          <h2>Shop by brand</h2>
          <button type="button" className="aisle-all" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show less ←" : `See all ${brandGroups.length} →`}
          </button>
        </div>
        <div id="brand-picker-products" className={`brand-row${showAll ? " brand-row--grid" : ""}`}>
          {brandGroups.map((group, index) => (
            <Link
              key={group.brand}
              href={`/?q=${encodeURIComponent(group.brand)}`}
              className="brand-tile"
            >
              <span
                className="brand-photo"
                style={{ background: aisleTint(index + 2) }}
              >
                {group.image_url ? (
                  <OptimizedImage
                    src={group.image_url}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <span>{group.brand.slice(0, 1)}</span>
                )}
              </span>
              <strong>{group.brand}</strong>
              <small>
                {group.count} {group.count === 1 ? "product" : "products"}
              </small>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
