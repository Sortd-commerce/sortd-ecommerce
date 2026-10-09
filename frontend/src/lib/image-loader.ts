/**
 * Custom Next.js image loader: resize/format on Cloudinary's CDN (f_auto, q_auto, w_*).
 * Avoids the default /_next/image pipeline, which decodes full-size sources in Node and
 * spikes RAM (especially AVIF) on image-heavy pages.
 */

const CLOUDINARY_HOST = /res\.cloudinary\.com/i;

export function cloudinaryDeliveryUrl(src: string, width: number, quality = 75): string {
  if (!CLOUDINARY_HOST.test(src) || !src.includes("/upload/")) {
    return src;
  }

  const [prefix, suffix] = src.split("/upload/");
  if (!suffix) return src;

  const baseChain = ["f_auto", "q_auto", "c_limit", `w_${width}`];
  if (quality && quality !== 75) {
    baseChain[1] = `q_${quality}`;
  }
  const chain = baseChain.join(",");

  const segments = suffix.split("/");
  const head = segments[0] ?? "";

  if (/^v\d+$/.test(head)) {
    return `${prefix}/upload/${chain}/${suffix}`;
  }

  if (head.includes(",")) {
    const parts = head.split(",").filter((token) => !token.startsWith("w_"));
    for (const token of ["f_auto", "q_auto", "c_limit"]) {
      if (!parts.includes(token)) parts.push(token);
    }
    parts.push(`w_${width}`);
    segments[0] = [...new Set(parts)].join(",");
    return `${prefix}/upload/${segments.join("/")}`;
  }

  return `${prefix}/upload/${chain}/${suffix}`;
}

type LoaderProps = { src: string; width: number; quality?: number };

export default function imageLoader({ src, width, quality }: LoaderProps): string {
  if (src.startsWith("/") && !src.startsWith("//")) {
    return src;
  }
  return cloudinaryDeliveryUrl(src, width, quality);
}
