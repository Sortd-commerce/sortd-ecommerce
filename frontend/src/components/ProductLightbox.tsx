"use client";

import { X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OptimizedImage } from "@/components/OptimizedImage";

type Slide = { url: string; alt: string };

export function ProductLightbox({
  images,
  startIndex,
  onClose,
}: {
  images: Slide[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, images.length - 1));
      setIndex(clamped);
      const track = trackRef.current;
      if (track) {
        const width = track.clientWidth;
        track.scrollTo({ left: width * clamped, behavior: "smooth" });
      }
    },
    [images.length],
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goTo(index + 1);
      if (event.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [goTo, index, onClose]);

  useEffect(() => {
    setIndex(startIndex);
    const track = trackRef.current;
    if (!track) return;
    const width = track.clientWidth;
    track.scrollTo({ left: width * startIndex, behavior: "auto" });
  }, [startIndex]);

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth < 1) return;
    const next = Math.round(track.scrollLeft / track.clientWidth);
    setIndex(Math.max(0, Math.min(next, images.length - 1)));
  };

  const onTrackTouchStart = (event: React.TouchEvent) => {
    const touch = event.changedTouches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTrackTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goTo(index + 1);
    else goTo(index - 1);
  };

  return (
    <div className="product-lightbox" role="dialog" aria-modal="true" aria-label="Product photos">
      <button type="button" className="product-lightbox-close" aria-label="Close gallery" onClick={onClose}>
        <X size={22} weight="bold" />
      </button>
      <div
        ref={trackRef}
        className="product-lightbox-track"
        onScroll={onScroll}
        onTouchStart={onTrackTouchStart}
        onTouchEnd={onTrackTouchEnd}
      >
        {images.map((image, slideIndex) => (
          <div key={`${image.url}-${slideIndex}`} className="product-lightbox-slide">
            <div
              className="product-lightbox-zoom"
              onTouchStart={(event) => event.stopPropagation()}
              onTouchEnd={(event) => event.stopPropagation()}
            >
              <OptimizedImage
                src={image.url}
                alt={image.alt}
                width={1400}
                height={2800}
                sizes="100vw"
                className="product-lightbox-img"
                priority={slideIndex === startIndex}
              />
            </div>
          </div>
        ))}
      </div>
      {images.length > 1 ? (
        <div className="product-lightbox-dots" aria-hidden>
          {images.map((_, dotIndex) => (
            <span key={dotIndex} className={dotIndex === index ? "is-active" : ""} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
