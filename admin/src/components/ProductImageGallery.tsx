"use client";

import { DotsSixVertical, Trash, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { deleteProductImageAction, reorderProductImagesAction } from "@/lib/actions";
import { ActionForm } from "@/components/ActionForm";
import { OptimizedImage } from "@/components/OptimizedImage";

export type GalleryImage = {
  id: number;
  url: string;
  alt: string;
  original_name: string;
  byte_size: number;
  created_at: string | null;
};

type Props = {
  productId: number;
  productTitle: string;
  images: GalleryImage[];
};

function formatBytes(bytes: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: bytes >= 1024 * 1024 ? 1 : 0 }).format(
    bytes >= 1024 * 1024 ? bytes / (1024 * 1024) : bytes >= 1024 ? bytes / 1024 : bytes,
  ) + (bytes >= 1024 * 1024 ? " MB" : bytes >= 1024 ? " KB" : " B");
}

function formatAdded(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function ProductImageGallery({ productId, productTitle, images }: Props) {
  const [rows, setRows] = useState(images);
  const [dragId, setDragId] = useState<number | null>(null);
  const [viewerId, setViewerId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRows(images);
  }, [images]);

  const viewer = useMemo(() => rows.find((row) => row.id === viewerId) || null, [rows, viewerId]);
  const viewerIndex = viewer ? rows.findIndex((row) => row.id === viewer.id) : -1;

  useEffect(() => {
    if (!viewer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerId(null);
      if (event.key === "ArrowRight" && viewerIndex < rows.length - 1) setViewerId(rows[viewerIndex + 1].id);
      if (event.key === "ArrowLeft" && viewerIndex > 0) setViewerId(rows[viewerIndex - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer, viewerIndex, rows]);

  async function persist(next: GalleryImage[]) {
    setBusy(true);
    setError("");
    const result = await reorderProductImagesAction(
      productId,
      next.map((row) => row.id),
    );
    setBusy(false);
    if (!result.ok) {
      setRows(images);
      setError(result.message || "Could not save the new order.");
      return;
    }
    setRows(next);
  }

  function move(id: number, direction: -1 | 1) {
    const index = rows.findIndex((row) => row.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return;
    const next = [...rows];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    void persist(next);
  }

  function onDrop(targetId: number) {
    if (dragId === null || dragId === targetId) return;
    const from = rows.findIndex((row) => row.id === dragId);
    const to = rows.findIndex((row) => row.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...rows];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setDragId(null);
    void persist(next);
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <p className="rounded-2xl bg-warn/10 px-4 py-3 text-sm text-warn" aria-live="polite">
          {error}
        </p>
      ) : null}
      {rows.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {rows.map((image, index) => (
            <li
              key={image.id}
              className={`flex items-center gap-3 bg-panel-2 px-3 py-2 ${dragId === image.id ? "opacity-60" : ""}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDrop(image.id)}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left hover:bg-panel focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => setViewerId(image.id)}
              >
                <OptimizedImage
                  src={image.url}
                  alt={image.alt || image.original_name || productTitle}
                  width={56}
                  height={56}
                  sizes="56px"
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" translate="no">
                    {image.original_name || image.alt || `Image ${index + 1}`}
                  </span>
                  <span className="mt-0.5 block text-xs tabular-nums text-muted">
                    {formatAdded(image.created_at)} · {formatBytes(image.byte_size)}
                    {index === 0 ? " · Primary" : ""}
                  </span>
                </span>
              </button>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="cursor-grab touch-manipulation rounded-lg p-2 text-muted hover:bg-panel hover:text-text focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
                  draggable
                  aria-label={`Drag to reorder ${image.original_name || "image"}`}
                  onDragStart={() => setDragId(image.id)}
                  onDragEnd={() => setDragId(null)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      move(image.id, -1);
                    }
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      move(image.id, 1);
                    }
                  }}
                >
                  <DotsSixVertical size={18} weight="bold" aria-hidden="true" />
                </button>
                <ActionForm action={deleteProductImageAction}>
                  <input type="hidden" name="product_id" value={productId} />
                  <input type="hidden" name="image_id" value={image.id} />
                  <button
                    type="submit"
                    className="rounded-lg p-2 text-muted hover:bg-panel hover:text-warn focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label={`Remove ${image.original_name || "image"}`}
                    onClick={(event) => {
                      if (!window.confirm("Remove this image from the product?")) event.preventDefault();
                    }}
                  >
                    <Trash size={18} aria-hidden="true" />
                  </button>
                </ActionForm>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-sm text-muted">
          No images yet. Choose one or more files below.
        </p>
      )}
      {busy ? (
        <p className="text-xs text-muted" aria-live="polite">
          Saving order…
        </p>
      ) : null}

      {viewer ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          style={{ overscrollBehavior: "contain" }}
          role="dialog"
          aria-modal="true"
          aria-label={viewer.original_name || "Product image"}
          onClick={() => setViewerId(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-panel p-2 text-text hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Close"
            onClick={() => setViewerId(null)}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <OptimizedImage
            src={viewer.url}
            alt={viewer.alt || viewer.original_name || productTitle}
            width={1200}
            height={800}
            sizes="100vw"
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
