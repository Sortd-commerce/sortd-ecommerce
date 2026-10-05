"use client";

import { useState } from "react";

type GalleryImage = { url: string; alt: string; role: string };

export function ProductGallery({ title, images }: { title: string; images: GalleryImage[] }) {
  const usable = images.filter((image) => image.url);
  const [active, setActive] = useState(0);
  const current = usable[active] || usable[0];

  if (!current) {
    return (
      <div className="gallery-stage gallery-empty">
        <p>No photos yet</p>
      </div>
    );
  }

  return (
    <div className="gallery">
      <div className="gallery-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.alt || title} />
      </div>
      {usable.length > 1 ? (
        <div className="gallery-thumbs">
          {usable.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              type="button"
              className={index === active ? "thumb-on" : ""}
              aria-label={`Show photo ${index + 1}`}
              aria-pressed={index === active}
              onClick={() => setActive(index)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
