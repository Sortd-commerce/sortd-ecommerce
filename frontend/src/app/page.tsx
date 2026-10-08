import Link from "next/link";
import { Manifesto } from "@/components/Manifesto";
import { OptimizedImage } from "@/components/OptimizedImage";
import { TrustStrip } from "@/components/TrustStrip";
import { ProductCard } from "@/components/ProductCard";
import { ProductRail } from "@/components/ProductRail";
import type { CardProduct } from "@/components/catalog";
import { fetchCategories, fetchProductCatalog } from "@/lib/catalog";
import { aisleTint } from "@/lib/tints";

type ProductList = { results: CardProduct[]; count: number };
type Category = { name: string; slug: string; image_url?: string | null };
type BrandGroup = { brand: string; count: number; image_url?: string | null };

function buildBrandGroups(products: CardProduct[]): BrandGroup[] {
  const map = new Map<string, BrandGroup>();
  for (const product of products) {
    const brand = product.brand?.trim();
    if (!brand) continue;
    const current = map.get(brand) || {
      brand,
      count: 0,
      image_url: product.primary_image?.url || null,
    };
    current.count += 1;
    if (!current.image_url && product.primary_image?.url) {
      current.image_url = product.primary_image.url;
    }
    map.set(brand, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function findGroup(groups: Array<Category & { products: CardProduct[] }>, needles: string[]) {
  return groups.find((group) =>
    needles.some((needle) => group.slug.includes(needle) || group.name.toLowerCase().includes(needle)),
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; aisle?: string }>;
}) {
  const { q = "", aisle = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const [products, categories] = await Promise.all([fetchProductCatalog(), fetchCategories()]);
  const results = products.data?.results || [];
  const filtered = results.filter((product) => {
    if (
      query &&
      !`${product.title} ${product.brand || ""} ${product.category.name} ${(product.tags || []).join(" ")}`
        .toLowerCase()
        .includes(query)
    ) {
      return false;
    }
    if (aisle && product.category.slug !== aisle) return false;
    return true;
  });
  const groups = (categories.data || [])
    .map((category) => ({
      ...category,
      products: filtered.filter((product) => product.category.slug === category.slug),
    }))
    .filter((group) => group.products.length);
  const aisleGroups = (categories.data || [])
    .filter((category) => results.some((product) => product.category.slug === category.slug));
  const promoSource = (categories.data || [])
    .map((category) => ({
      ...category,
      products: results.filter((product) => product.category.slug === category.slug),
    }))
    .filter((group) => group.products.length);
  const breakfast = findGroup(promoSource, ["breakfast", "spread", "oat"]) || promoSource[0];
  const chocolateMatch = findGroup(promoSource, ["chocolate", "cocoa"]);
  const chocolate =
    chocolateMatch && chocolateMatch.slug !== breakfast?.slug
      ? chocolateMatch
      : promoSource.find((group) => group.slug !== breakfast?.slug);
  const brandGroups = buildBrandGroups(results);
  const showLanding = !query && !aisle;

  return (
    <div className="home">
      {!products.ok ? (
        <div className="home-section">
          <div className="home-inner">
            <p className="catalog-error">{products.message}</p>
          </div>
        </div>
      ) : null}

      {showLanding && aisleGroups.length ? (
        <section className="home-section home-section--tight" aria-label="Shop by aisle">
          <div className="home-inner aisle-picker">
            <div className="aisle-head">
              <h2>Shop by aisle</h2>
              <a href="#catalog" className="aisle-all">
                ALL {aisleGroups.length} →
              </a>
            </div>
            <div className="aisle-row">
              {aisleGroups.map((category, index) => (
                <a key={category.slug} href={`#aisle-${category.slug}`} className="aisle-tile">
                  <span className="aisle-photo" style={{ background: aisleTint(index) }}>
                    {category.image_url ? (
                      <OptimizedImage
                        src={category.image_url}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-contain"
                      />
                    ) : (
                      <span>{category.name.slice(0, 1)}</span>
                    )}
                  </span>
                  <span>{category.name}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {showLanding && (breakfast || chocolate) ? (
        <section className="home-section home-section--promo">
          <div className="home-inner promo-row">
            {breakfast ? (
              <a href={`#aisle-${breakfast.slug}`} className="promo promo-breakfast">
                <OptimizedImage src="/images/promo-breakfast.png" alt="" fill className="promo-bg" sizes="(max-width: 768px) 100vw, 50vw" />
                <div className="promo-copy">
                  <p>Breakfast</p>
                  <h2>Breakfast, sorted.</h2>
                  <strong>Shop breakfast →</strong>
                </div>
              </a>
            ) : null}
            {chocolate ? (
              <a href={`#aisle-${chocolate.slug}`} className="promo promo-chocolate">
                <OptimizedImage src="/images/promo-chocolate.png" alt="" fill className="promo-bg" sizes="(max-width: 768px) 100vw, 50vw" />
                <div className="promo-copy">
                  <p>Chocolate</p>
                  <h2>Chocolate, chosen carefully.</h2>
                  <strong>Shop chocolate →</strong>
                </div>
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      {showLanding && brandGroups.length ? (
        <section className="home-section home-section--brands" aria-label="Shop by brand">
          <div className="home-inner brand-picker">
            <div className="aisle-head">
              <h2>Shop by brand</h2>
              <a href="#catalog" className="aisle-all">
                ALL {brandGroups.length} →
              </a>
            </div>
            <div className="brand-row">
              {brandGroups.map((group, index) => (
                <Link key={group.brand} href={`/?q=${encodeURIComponent(group.brand)}`} className="brand-tile">
                  <span className="brand-photo" style={{ background: aisleTint(index + 2) }}>
                    {group.image_url ? (
                      <OptimizedImage
                        src={group.image_url}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-contain"
                      />
                    ) : (
                      <span>{group.brand.slice(0, 1)}</span>
                    )}
                  </span>
                  <strong>{group.brand}</strong>
                  <small>
                    {group.count} {group.count === 1 ? "product" : "products"}
                  </small>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {(query || aisle) && (
        <div className="home-section">
          <div className="home-inner">
            <p className="filter-note">
              {query
                ? `Results for “${q.trim()}”`
                : aisleGroups.find((row) => row.slug === aisle)?.name || "Filtered results"}
              {query && aisle ? ` · ${aisleGroups.find((row) => row.slug === aisle)?.name || aisle}` : ""}
              {" · "}
              <Link href="/">Clear</Link>
            </p>
          </div>
        </div>
      )}

      <section className="home-section home-section--catalog">
        <div id="catalog" className="home-inner catalog">
          {groups.map((group) => (
            <ProductRail key={group.slug} id={`aisle-${group.slug}`} title={group.name} count={group.products.length}>
              {group.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ProductRail>
          ))}
          {products.ok && !results.length ? <p className="empty-catalog">Nothing here yet.</p> : null}
          {products.ok && results.length > 0 && !groups.length ? (
            <p className="empty-catalog">Nothing matched that search.</p>
          ) : null}
        </div>
      </section>

      {showLanding ? <TrustStrip /> : null}

      <Manifesto />
    </div>
  );
}
