import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export function Manifesto() {
  return (
    <section className="manifesto" id="manifesto">
      <div className="manifesto-inner">
        <BrandMark tone="cream" size="sm" href={null} />
        <h2>
          That&apos;s Sortd.
          <br />
          Only what passes.
          <br />
          Everything else is removed.
        </h2>
        <Link href="/#catalog" className="btn btn-light">
          See the products
        </Link>
      </div>
      <footer className="manifesto-foot">
        <p>Only what passes.</p>
        <nav aria-label="Footer">
          <Link href="/">Home</Link>
          <a href="#manifesto">About</a>
          <a href="/#catalog">Products</a>
          <a href="/#catalog">Lab reports</a>
        </nav>
      </footer>
    </section>
  );
}
