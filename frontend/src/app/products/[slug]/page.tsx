import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyBox } from "@/app/products/[slug]/BuyBox";
import { LabelChecked } from "@/app/products/[slug]/LabelChecked";
import { ProductGallery } from "@/app/products/[slug]/ProductGallery";
import { Manifesto } from "@/components/Manifesto";
import { ProductCard } from "@/components/ProductCard";
import { ProductRail } from "@/components/ProductRail";
import type { CardProduct } from "@/components/catalog";
import { apiFetch } from "@/lib/api";
import { fetchProductCatalog } from "@/lib/catalog";

type ProductDetail = {
  title: string;
  slug: string;
  brand: string;
  description: string;
  shelf: string;
  tags: string[];
  has_passed_report: boolean;
  has_lab_report: boolean;
  category: { name: string; slug: string };
  images: Array<{ url: string; alt: string; role: string }>;
  variants: Array<{
    id: number;
    sku: string;
    title: string;
    price: string;
    compare_at_price: string | null;
    unit_count: number;
    max_order: number | null;
    on_hand: number;
    is_active: boolean;
  }>;
  related: Array<{ title: string; slug: string; kind: string }>;
  label: {
    serving_size: string;
    serving_basis: string;
    headline: string;
    note: string;
    guidance: string;
    facts: Array<{
      name: string;
      amount: string;
      unit: string;
      daily_value?: string;
      is_highlight: boolean;
      level: string;
      note: string;
      group: string;
      is_subfact: boolean;
    }>;
    ingredients: Array<{ name: string; share_percent: string | null; detail: string; is_flagged: boolean }>;
    allergens: Array<{ name: string; detail: string }>;
    checks: {
      banned_found: number;
      hidden_sugars_found: number;
      shares_printed: boolean;
      sugar_source: string;
      nutritionist_note: string;
      lab_passed: boolean;
      lab_passed_count: number;
      lab_total_count: number;
    };
  } | null;
};

function flavorLabel(title: string) {
  const parts = title.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : title;
}

function buyHighlights(headline: string | undefined, ingredientCount: number) {
  if (headline) {
    const parts = headline.split(".").map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 3) {
      return parts.slice(0, 3).map((part) => {
        const words = part.split(/\s+/);
        if (/^six$/i.test(words[0])) {
          return { value: "6", label: words.slice(1).join(" ").toLowerCase() };
        }
        if (/^[\d.]+%?$/.test(words[0])) {
          return { value: words[0], label: words.slice(1).join(" ").toLowerCase() };
        }
        if (/^coconut$/i.test(words[0])) {
          const tail = words
            .slice(1)
            .join(" ")
            .toLowerCase()
            .replace(/nothing more/i, "nothing refined");
          return { value: "Coconut", label: tail };
        }
        return { value: words[0], label: words.slice(1).join(" ").toLowerCase() };
      });
    }
  }

  return [
    ingredientCount ? { value: String(ingredientCount), label: "ingredients" } : null,
  ].filter((row): row is { value: string; label: string } => Boolean(row));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [result, catalog] = await Promise.all([
    apiFetch<ProductDetail>(`/products/${slug}`, { auth: false, revalidate: 60 }),
    fetchProductCatalog(),
  ]);
  if (!result.ok || !result.data) notFound();
  const product = result.data;
  const results = catalog.data?.results || [];
  const bySlug = new Map(results.map((row) => [row.slug, row]));
  const flavors = product.related
    .filter((row) => row.kind === "flavor")
    .map((row) => ({
      title: flavorLabel(row.title),
      slug: row.slug,
      image: bySlug.get(row.slug)?.primary_image?.url || "",
    }));
  const rail = results
    .filter((row) => row.slug !== product.slug && row.category.slug === product.category.slug)
    .sort((a, b) => Number(b.has_passed_report) - Number(a.has_passed_report))
    .slice(0, 8);
  const highlights = buyHighlights(product.label?.headline, product.label?.ingredients.length || 0);

  return (
    <div className="product-page">
      <section className="home-section">
        <div className="home-inner">
          <nav className="crumbs product-crumbs" aria-label="Breadcrumb">
            <Link href="/">Shop</Link>
            <span>/</span>
            <Link href={`/?aisle=${product.category.slug}`}>{product.category.name.toUpperCase()}</Link>
            {product.shelf ? (
              <>
                <span>/</span>
                <span>{product.shelf.toUpperCase()}</span>
              </>
            ) : null}
            <span>/</span>
            <span aria-current="page">{product.title.toUpperCase()}</span>
          </nav>

          <div className="product-layout">
            <ProductGallery title={product.title} images={product.images || []} />
            <BuyBox
              title={product.title}
              brand={product.brand || product.category.name}
              flavorLabel={flavorLabel(product.title)}
              description={product.description}
              currentSlug={product.slug}
              imageUrl={product.images?.find((image) => image.url)?.url}
              variants={product.variants || []}
              flavors={flavors}
              highlights={highlights}
              hasLabReport={product.has_lab_report || product.has_passed_report}
            />
          </div>

          {product.label ? (
            <LabelChecked
              slug={product.slug}
              label={product.label}
              hasLabReport={product.has_lab_report || product.has_passed_report}
              templateLabel={product.category.name}
            />
          ) : null}
        </div>
      </section>

      {rail.length ? (
        <section className="home-section home-section--catalog">
          <div className="home-inner">
            <ProductRail id="also-passed" title="Also passed our checks" count={rail.length}>
              {rail.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </ProductRail>
          </div>
        </section>
      ) : null}

      <Manifesto />
    </div>
  );
}
