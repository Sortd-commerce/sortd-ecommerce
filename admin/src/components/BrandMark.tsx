import Link from "next/link";

export function BrandMark({
  tone = "light",
  size = "md",
  href = "/",
}: {
  tone?: "light" | "muted";
  size?: "sm" | "md";
  href?: string | null;
}) {
  const className = `brand-mark tone-${tone}${size === "sm" ? " brand-sm" : ""}`;
  const word = (
    <>
      Sortd<span className="brand-period">.</span>
    </>
  );
  if (!href) return <span className={className}>{word}</span>;
  return (
    <Link href={href} className={className} aria-label="Sortd home">
      {word}
    </Link>
  );
}
