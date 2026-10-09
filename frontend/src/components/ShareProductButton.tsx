"use client";

import { ShareNetwork } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import { shareProduct } from "@/lib/share-product";
import { useToast } from "@/components/Toast";

export function ShareProductButton({
  title,
  slug,
  className = "",
  label = "Share product",
}: {
  title: string;
  slug: string;
  className?: string;
  label?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const url = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/products/${slug}`;
  }, [slug]);

  const onShare = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const shareUrl = url || `${window.location.origin}/products/${slug}`;
    const result = await shareProduct({ title, url: shareUrl });
    setBusy(false);
    if (result === "shared") {
      toast.success("Link shared");
      return;
    }
    if (result === "copied") {
      toast.success("Link copied");
      return;
    }
    toast.error("Could not share this product");
  }, [busy, slug, title, toast, url]);

  return (
    <button
      type="button"
      className={`share-product-btn ${className}`.trim()}
      aria-label={label}
      disabled={busy}
      onClick={() => void onShare()}
    >
      <ShareNetwork size={20} weight="bold" aria-hidden />
    </button>
  );
}
