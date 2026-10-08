"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OptimizedImage } from "@/components/OptimizedImage";

type GalleryImage = { url: string; alt: string; role: string };

function LabReportIcon() {
  return (
    <svg viewBox="0 0 14 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2 0h7l5 5v9a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2Zm6.5 0V5H13L8.5 0ZM4 8.5h6v1.5H4V8.5Zm0 3h4v1.5H4V11.5Z"
      />
    </svg>
  );
}

export function ProductGallery({
  title,
  images,
  hasLabReport = false,
}: {
  title: string;
  images: GalleryImage[];
  hasLabReport?: boolean;
}) {
  const usable = images.filter((image) => image.url);
  const [active, setActive] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const syncFromScroll = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || usable.length < 2) return;
    const width = stage.clientWidth;
    if (width < 1) return;
    const index = Math.round(stage.scrollLeft / width);
    setActive(Math.max(0, Math.min(index, usable.length - 1)));
  }, [usable.length]);

  const goTo = useCallback(
    (index: number) => {
      const stage = stageRef.current;
      const next = Math.max(0, Math.min(index, usable.length - 1));
      if (stage) {
        const width = stage.clientWidth;
        stage.scrollTo({
          left: width * next,
          behavior: prefersReducedMotion.current ? "auto" : "smooth",
        });
      }
      setActive(next);
    },
    [usable.length],
  );

  useEffect(() => {
    thumbRefs.current[active]?.scrollIntoView({
      behavior: prefersReducedMotion.current ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [active]);

  if (!usable.length) {
    return (
      <div className="gallery-stage gallery-empty">
        <p>No photos yet</p>
      </div>
    );
  }

  return (
    <div className="gallery">
      <div
        ref={stageRef}
        className="gallery-stage"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} photos`}
        onScroll={syncFromScroll}
      >
        {usable.map((image, index) => (
          <div key={`${image.url}-${index}`} className="gallery-slide" aria-hidden={index !== active}>
            <OptimizedImage
              src={image.url}
              alt={image.alt || title}
              fill
              priority={index === 0}
              sizes="(max-width: 768px) 100vw, 640px"
              className="gallery-stage__img"
            />
          </div>
        ))}
        {hasLabReport ? (
          <div className="gallery-lab-badge">
            <LabReportIcon />
            <span>Lab report</span>
          </div>
        ) : null}
        {usable.length > 1 ? (
          <div className="gallery-dots" role="tablist" aria-label="Choose photo">
            {usable.map((_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                className={index === active ? "gallery-dot gallery-dot--active" : "gallery-dot"}
                aria-label={`Show photo ${index + 1}`}
                aria-selected={index === active}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
        ) : null}
      </div>
      {usable.length > 1 ? (
        <div className="gallery-thumbs">
          {usable.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              ref={(node) => {
                thumbRefs.current[index] = node;
              }}
              type="button"
              className={index === active ? "gallery-thumb gallery-thumb--active" : "gallery-thumb"}
              aria-label={`Show photo ${index + 1}`}
              aria-pressed={index === active}
              onClick={() => goTo(index)}
            >
              <OptimizedImage
                src={image.url}
                alt=""
                fill
                sizes="118px"
                className={index === active ? "gallery-thumb__img gallery-thumb__img--inset" : "gallery-thumb__img"}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
