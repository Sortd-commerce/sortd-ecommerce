import Image, { type ImageProps } from "next/image";

function isSvg(src: ImageProps["src"]) {
  if (typeof src === "string") return src.endsWith(".svg");
  if (typeof src === "object" && src !== null && "src" in src) {
    return String(src.src).endsWith(".svg");
  }
  return false;
}

export type OptimizedImageProps = ImageProps;

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
      unoptimized={
        unoptimized ??
        (isSvg(props.src) ||
          (typeof props.src === "string" && props.src.startsWith("/") && !props.src.startsWith("//")))
      }
    />
  );
}
