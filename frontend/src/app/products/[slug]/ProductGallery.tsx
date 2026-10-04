"use client";

import { useState } from "react";

type GalleryImage = { url: string; alt: string; role: string };

export function ProductGallery({ title, images }: { title: string; images: GalleryImage[] }) {
  const usable = images.filter((image) => image.url);
  const [active, setActive] = useState(0);
  const current = usable[active] || usable[0];

  if (!current) {
    return (
      <div className="flex min-h-[280px] items-end bg-sand p-8 md:min-h-[360px]">
        <p className="text-sm text-ink/50">No photos yet</p>
      </div>
    );
  }

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={current.alt || title}
        width={800}
        height={360}
        className="h-[280px] w-full bg-sand object-contain md:h-[360px]"
      />
      {usable.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto border-t border-line p-3">
          {usable.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              type="button"
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
                index === active ? "border-forest" : "border-line"
              }`}
              aria-label={`Show photo ${index + 1}`}
              aria-pressed={index === active}
              onClick={() => setActive(index)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" width={64} height={64} className="h-16 w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
