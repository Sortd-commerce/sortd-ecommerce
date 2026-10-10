import Link from "next/link";

export function BrandMark({
  tone = "forest",
  size = "md",
  href = "/",
}: {
  tone?: "forest" | "cream";
  size?: "sm" | "md";
  href?: string | null;
}) {
  const className = `brand-mark tone-${tone}${size === "sm" ? " brand-sm" : ""}`;
  const mark = (
    <img
      src="/images/sortd-wordmark.svg"
      alt={href ? "" : "Sortd"}
      width={148}
      height={44}
      className="brand-mark-img"
    />
  );
  if (!href) return <span className={className}>{mark}</span>;
  return (
    <Link href={href} className={className} aria-label="Sortd home">
      {mark}
    </Link>
  );
}
