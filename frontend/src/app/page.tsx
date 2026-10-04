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
    <div className="space-y-12">
      <section className="grid gap-8 pt-6 md:grid-cols-[1.15fr_0.85fr] md:items-center">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight text-forest md:text-6xl">
            SORTD
          </h1>
          <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-ink/75">
            Lab-checked pantry picks. Labels we verified, contaminants we screened, stock we keep honest.
          </p>
        </div>
        <div className="card-quiet rounded-xl p-6">
          <p className="font-medium text-forest">Report on file</p>
          <p className="mt-2 max-w-[65ch] text-ink/75">
            Every product page can show the lab report behind the seal — metals, mycotoxins, microbes, pesticides, and label claims.
          </p>
        </div>
      </section>

      {!products.ok ? <p className="text-sm text-citrus">{products.message}</p> : null}

      {(groups.length ? groups : results.length ? [{ slug: "all", name: "All products", products: results }] : []).map(
        (group) => (
        <section key={group.slug}>
          <h2 className="mb-5 font-[family-name:var(--font-display)] text-3xl text-forest">{group.name}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="card-quiet group rounded-xl p-4 transition hover:-translate-y-px"
              >
                <div className="mb-5 flex h-36 items-end overflow-hidden rounded-lg bg-sand">
                  {product.primary_image?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.primary_image.url}
                      alt={product.primary_image.alt || product.title}
                      width={360}
                      height={144}
                      className="h-36 w-full object-contain"
                    />
                  ) : (
                    <span className="p-4 text-xs uppercase tracking-[0.16em] text-leaf">{product.category.name}</span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold leading-snug">{product.title}</h3>
                    <p className="mt-2 text-sm text-ink/60">
                      {product.has_passed_report ? "Lab report on file" : "Awaiting report"}
                    </p>
                  </div>
                  <p className="font-semibold text-forest">
                    {product.from_price ? `AED ${product.from_price}` : "—"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {products.ok && !results.length ? (
        <div className="card-quiet rounded-[1.6rem] p-8 text-ink/70">
          No active products yet. Add some from the admin panel.
        </div>
      ) : null}
    </div>
  );
}
