import Link from "next/link";
import { apiFetch } from "@/lib/api";

type ProductCard = {
  id: number;
  title: string;
  slug: string;
  from_price: string | null;
  has_passed_report: boolean;
  category: { name: string; slug: string };
  primary_image: { url: string; alt: string } | null;
};

type ProductList = { results: ProductCard[]; count: number };
type Category = { name: string; slug: string };

export default async function HomePage() {
  const [products, categories] = await Promise.all([
    apiFetch<ProductList>("/products?page_size=100", { auth: false }),
    apiFetch<Category[]>("/categories", { auth: false }),
  ]);
  const results = products.data?.results || [];
  const groups = (categories.data || [])
    .map((category) => ({
      ...category,
      products: results.filter((product) => product.category.slug === category.slug),
    }))
    .filter((group) => group.products.length);

  return (
    <div className="space-y-14">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="hero-kicker">Lab-checked pantry</p>
          <h1 className="hero-brand">SORTD</h1>
          <p className="hero-lede">
            Labels we verified. Contaminants we screened. Stock we keep honest — shop what actually passes.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#catalog" className="btn btn-primary">
              Shop now
            </a>
            <Link href="/cart" className="btn btn-secondary">
              View cart
            </Link>
          </div>
        </div>
      </section>

      {!products.ok ? <p className="text-sm text-citrus">{products.message}</p> : null}

      <div id="catalog" className="space-y-12">
        {(groups.length ? groups : results.length ? [{ slug: "all", name: "All products", products: results }] : []).map(
          (group) => (
            <section key={group.slug}>
              <div className="mb-5 flex items-end justify-between gap-3">
                <h2 className="font-[family-name:var(--font-display)] text-3xl text-forest md:text-4xl">{group.name}</h2>
                <span className="text-sm text-ink/50">{group.products.length} products</span>
              </div>
              <div className="product-grid">
                {group.products.map((product) => (
                  <Link key={product.id} href={`/products/${product.slug}`} className="product-card">
                    <div className="product-card-media">
                      {product.primary_image?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.primary_image.url}
                          alt={product.primary_image.alt || product.title}
                          width={360}
                          height={220}
                          className="product-card-img"
                        />
                      ) : (
                        <span className="product-card-fallback">{product.category.name}</span>
                      )}
                    </div>
                    <div className="product-card-body">
                      <div className="min-w-0">
                        <h3 className="product-card-title">{product.title}</h3>
                        <p className="mt-1.5 text-sm text-ink/55">
                          {product.has_passed_report ? "Lab report on file" : "Awaiting report"}
                        </p>
                      </div>
                      <p className="product-card-price">
                        {product.from_price ? `AED ${product.from_price}` : "—"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ),
        )}
      </div>

      {products.ok && !results.length ? (
        <div className="card-quiet rounded-2xl p-8 text-ink/70">
          No active products yet. Add some from the admin panel.
        </div>
      ) : null}
    </div>
  );
}
