import Image, { type ImageProps } from "next/image";
import { cloudinaryDeliveryUrl } from "@/lib/image-loader";

function isSvg(src: ImageProps["src"]) {
  if (typeof src === "string") return src.endsWith(".svg");
  if (typeof src === "object" && src !== null && "src" in src) {
    return String(src.src).endsWith(".svg");
  }
  return false;
}

export type OptimizedImageProps = ImageProps;

function shouldBypassOptimizer(src: ImageProps["src"]) {
  if (isSvg(src)) return true;
  if (typeof src === "string" && src.startsWith("/") && !src.startsWith("//")) {
    return true;
  }
  return false;
}

export function OptimizedImage({
  priority,
  unoptimized,
  loading,
  decoding,
  alt = "",
  ...props
}: OptimizedImageProps) {
  return (
    <Image
      {...props}
      alt={alt}
      loading={loading ?? (priority ? undefined : "lazy")}
      decoding={decoding ?? "async"}
      unoptimized={unoptimized ?? shouldBypassOptimizer(props.src)}
    />
  );
}

/** Direct CDN URL when you need a sized asset outside `<Image />` (e.g. preload). */
export function sizedImageUrl(src: string, width: number, quality?: number) {
  return cloudinaryDeliveryUrl(src, width, quality);
}
