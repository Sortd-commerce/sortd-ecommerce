import Link from "next/link";
import { OptimizedImage } from "@/components/OptimizedImage";

export function Manifesto() {
  return (
    <footer className="manifesto">
      <div className="manifesto-frame">
        <div className="manifesto-photo" aria-hidden>
          <OptimizedImage
            src="/images/footer-produce.png"
            alt=""
            fill
            sizes="100vw"
            className="manifesto-photo-img"
          />
        </div>
        <div className="manifesto-shell">
          <div className="manifesto-panel">
            <h2>
              <span>That&apos;s Sortd.</span>
              <span className="manifesto-accent">Only what passes.</span>
              <span>Everything else is removed.</span>
            </h2>
            <Link href="/#catalog" className="manifesto-cta">
              See The Products
            </Link>
            <div className="manifesto-foot">
              <nav className="manifesto-links manifesto-links--mobile" aria-label="Footer">
                <Link href="/">Home</Link>
                <Link href="/#catalog">Products</Link>
              </nav>
              <div className="manifesto-meta manifesto-meta--mobile">
                <p className="manifesto-tagline">Only what passes.</p>
                <p className="manifesto-copy">© 2026 SORTD</p>
              </div>
              <div className="manifesto-meta manifesto-meta--desktop">
                <p className="manifesto-tagline">Only what passes.</p>
                <nav className="manifesto-links" aria-label="Footer">
                  <Link href="/">Home</Link>
                  <Link href="/#catalog">Products</Link>
                  <span className="manifesto-copy">© 2026 SORTD</span>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
