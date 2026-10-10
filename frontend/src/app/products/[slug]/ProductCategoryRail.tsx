import { ProductCard } from "@/components/ProductCard";
import { ProductRail } from "@/components/ProductRail";
import { fetchProductCatalog } from "@/lib/catalog";

export async function ProductCategoryRail({ slug, categorySlug }: { slug: string; categorySlug: string }) {
  const catalog = await fetchProductCatalog();
  const results = catalog.data?.results || [];
  const rail = results
    .filter((row) => row.slug !== slug && row.category.slug === categorySlug)
    .sort((a, b) => Number(b.has_passed_report) - Number(a.has_passed_report))
    .slice(0, 8);

  if (!rail.length) return null;

  return (
    <section className="home-section home-section--catalog product-rail-section">
      <div className="home-inner">
        <ProductRail id="also-passed" title="Also passed our checks">
          {rail.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </ProductRail>
      </div>
    </section>
  );
}
