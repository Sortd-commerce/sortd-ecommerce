import Link from "next/link";
import { Manifesto } from "@/components/Manifesto";
import { ProductCard } from "@/components/ProductCard";
import { ProductRail } from "@/components/ProductRail";
import type { CardProduct } from "@/components/catalog";
import { apiFetch } from "@/lib/api";

type ProductList = { results: CardProduct[]; count: number };
type Category = { name: string; slug: string };

const GATES = [
  { title: "Four gates", detail: "Checked before it is listed." },
  { title: "100% released", detail: "If it is here, it passed." },
  { title: "Lab reports", detail: "On each product, when signed off." },
  { title: "30 minutes", detail: "Dubai delivery, when a window is open." },
];

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
  const [products, categories] = await Promise.all([
    apiFetch<ProductList>("/products?page_size=100", { auth: false }),
    apiFetch<Category[]>("/categories", { auth: false }),
  ]);
  const results = products.data?.results || [];
  const filtered = results.filter((product) => {
    if (query && !`${product.title} ${product.category.name}`.toLowerCase().includes(query)) return false;
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
    .map((category) => ({
      ...category,
      cover: results.find((product) => product.category.slug === category.slug && product.primary_image?.url),
    }))
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
  const showLanding = !query && !aisle;

  return (
    <div className="home">
      {!products.ok ? <p className="catalog-error">{products.message}</p> : null}

      {showLanding && aisleGroups.length ? (
        <section className="aisle-picker" aria-label="Shop by aisle">
          <h2>Shop by aisle</h2>
          <div className="aisle-row">
            {aisleGroups.map((category) => (
              <a key={category.slug} href={`#aisle-${category.slug}`} className="aisle-tile">
                <span className="aisle-photo">
                  {category.cover?.primary_image?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={category.cover.primary_image.url} alt="" />
                  ) : (
                    <span>{category.name.slice(0, 1)}</span>
                  )}
                </span>
                <span>{category.name}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {showLanding && (breakfast || chocolate) ? (
        <section className="promo-row">
          {breakfast ? (
            <a href={`#aisle-${breakfast.slug}`} className="promo promo-photo">
              <div>
                <p>Breakfast</p>
                <h2>Breakfast, sorted.</h2>
                <span>Spreads, oats and seeds that cleared all four gates.</span>
                <strong>Shop breakfast →</strong>
              </div>
              <div className="promo-photos">
                {breakfast.products.slice(0, 3).map((product) =>
                  product.primary_image?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={product.id} src={product.primary_image.url} alt="" />
                  ) : null,
                )}
              </div>
            </a>
          ) : null}
          {chocolate ? (
            <a href={`#aisle-${chocolate.slug}`} className="promo promo-solid">
              <p>Chocolate</p>
              <h2>Chocolate, chosen carefully.</h2>
              <span>Bars and truffles held to the same standard as everything else.</span>
              <strong>Shop chocolate →</strong>
            </a>
          ) : null}
        </section>
      ) : null}

      {(query || aisle) && (
        <p className="filter-note">
          {query ? `Results for “${q.trim()}”` : `Aisle`}
          {aisle ? ` · ${aisleGroups.find((row) => row.slug === aisle)?.name || aisle}` : ""}
          {" · "}
          <Link href="/">Clear</Link>
        </p>
      )}

      <div id="catalog" className="catalog">
        {groups.map((group) => (
          <ProductRail key={group.slug} id={`aisle-${group.slug}`} title={group.name} count={group.products.length}>
            {group.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ProductRail>
        ))}
        {products.ok && !results.length ? <p className="empty-catalog">No active products yet.</p> : null}
        {products.ok && results.length > 0 && !groups.length ? <p className="empty-catalog">Nothing matched that search.</p> : null}
      </div>

      {showLanding ? (
        <section className="trust-row" aria-label="How Sortd checks products">
          {GATES.map((gate) => (
            <div key={gate.title}>
              <strong>{gate.title}</strong>
              <span>{gate.detail}</span>
            </div>
          ))}
        </section>
      ) : null}

      <Manifesto />
    </div>
  );
}
