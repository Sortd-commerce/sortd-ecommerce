"use client";

import { useState } from "react";
import { OptimizedImage } from "@/components/OptimizedImage";

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
        <OptimizedImage
          src={current.url}
          alt={current.alt || title}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain"
        />
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
              <OptimizedImage
                src={image.url}
                alt=""
                fill
                sizes="72px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
