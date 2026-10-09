"use client";

import { ArrowLeft, MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductLightbox } from "@/components/ProductLightbox";
import { ShareProductButton } from "@/components/ShareProductButton";
import { OptimizedImage } from "@/components/OptimizedImage";
import { useGalleryImageLoad } from "@/lib/use-gallery-image-load";

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
  slug,
  images,
  labReportUrl,
}: {
  title: string;
  slug: string;
  images: GalleryImage[];
  labReportUrl?: string | null;
}) {
  const router = useRouter();
  const usable = images.filter((image) => image.url);
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { loaded: loadedSlides, markLoaded: markSlideLoaded } = useGalleryImageLoad(usable.length, active);
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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || usable.length < 2) return;

    const slides = stage.querySelectorAll<HTMLElement>("[data-gallery-slide]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target;
          if (!(target instanceof HTMLElement)) continue;
          const index = Number(target.dataset.gallerySlide);
          if (Number.isFinite(index)) markSlideLoaded(index);
        }
      },
      { root: stage, threshold: 0.4 },
    );

    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [markSlideLoaded, usable.length]);

  if (!usable.length) {
    return (
      <div className="gallery-stage gallery-empty">
        <p>No photos yet</p>
      </div>
    );
  }

  return (
    <div className="gallery">
      <div className="gallery-mobile-chrome" aria-hidden={false}>
        <button type="button" className="gallery-float-btn" aria-label="Go back" onClick={() => router.back()}>
          <ArrowLeft size={20} weight="bold" />
        </button>
        <div className="gallery-float-group">
          <Link href="/?focus=search" className="gallery-float-btn" aria-label="Search products">
            <MagnifyingGlass size={20} weight="bold" />
          </Link>
          <ShareProductButton title={title} slug={slug} className="gallery-float-btn" />
        </div>
      </div>
      <div className="gallery-stage-wrap">
        <div
          ref={stageRef}
          className="gallery-stage"
          role="region"
          aria-roledescription="carousel"
          aria-label={`${title} photos`}
          onScroll={syncFromScroll}
        >
          {usable.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              type="button"
              data-gallery-slide={index}
              className="gallery-slide gallery-slide--tap"
              aria-label={`Open photo ${index + 1} full screen`}
              aria-hidden={index !== active}
              onClick={() => {
                setActive(index);
                setLightboxOpen(true);
              }}
            >
              {loadedSlides.has(index) ? (
                <OptimizedImage
                  src={image.url}
                  alt={image.alt || title}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 768px) 100vw, 640px"
                  className="gallery-stage__img"
                />
              ) : (
                <span className="gallery-image-placeholder" aria-hidden />
              )}
            </button>
          ))}
        </div>
        {labReportUrl ? (
          <a href={labReportUrl} target="_blank" rel="noopener noreferrer" className="gallery-lab-badge">
            <LabReportIcon />
            <span>Lab report</span>
          </a>
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
                onClick={(event) => {
                  event.stopPropagation();
                  goTo(index);
                }}
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
              {loadedSlides.has(index) ? (
                <OptimizedImage src={image.url} alt="" fill sizes="118px" className="gallery-thumb__img" />
              ) : (
                <span className="gallery-image-placeholder" aria-hidden />
              )}
            </button>
          ))}
        </div>
      ) : null}
      {lightboxOpen ? (
        <ProductLightbox
          images={usable.map((image) => ({ url: image.url, alt: image.alt || title }))}
          startIndex={active}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </div>
  );
}
