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
  const className = `brand-mark tone-${tone} brand-${size}`;
  const word = (
    <>
      Sortd
      <span className="brand-stop" aria-hidden />
    </>
  );
  if (!href) return <span className={className}>{word}</span>;
  return (
    <Link href={href} className={className} aria-label="Sortd home">
      {word}
    </Link>
  );
}
