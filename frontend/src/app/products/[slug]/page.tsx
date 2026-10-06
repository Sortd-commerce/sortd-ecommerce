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

type ProductDetail = {
  title: string;
  slug: string;
  description: string;
  has_passed_report: boolean;
  category: { name: string; slug: string };
  images: Array<{ url: string; alt: string; role: string }>;
  variants: Array<{
    id: number;
    sku: string;
    title: string;
    price: string;
    compare_at_price: string | null;
    unit_count: number;
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

type ProductList = { results: CardProduct[] };

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [result, catalog] = await Promise.all([
    apiFetch<ProductDetail>(`/products/${slug}`, { auth: false }),
    apiFetch<ProductList>("/products?page_size=100", { auth: false }),
  ]);
  if (!result.ok || !result.data) notFound();
  const product = result.data;
  const results = catalog.data?.results || [];
  const bySlug = new Map(results.map((row) => [row.slug, row]));
  const linked = product.related.map((row) => bySlug.get(row.slug)).filter((row): row is CardProduct => Boolean(row));
  const others = results.filter((row) => row.slug !== product.slug);
  const passed = others.filter((row) => row.has_passed_report);
  const rail = linked.length ? linked : (passed.length ? passed : others).slice(0, 8);
  const flavors = product.related
    .filter((row) => row.kind === "flavor")
    .map((row) => ({
      title: row.title,
      slug: row.slug,
      image: bySlug.get(row.slug)?.primary_image?.url || "",
    }));
  const facts = product.label?.facts.filter((fact) => fact.is_highlight) || [];
  const highlights = [
    ...facts.slice(0, 2).map((fact) => ({
      value: `${fact.amount}${fact.unit ? ` ${fact.unit}` : ""}`,
      label: fact.name,
    })),
    product.label?.ingredients.length
      ? { value: String(product.label.ingredients.length), label: "Ingredients" }
      : null,
  ]
    .filter((row): row is { value: string; label: string } => Boolean(row))
    .slice(0, 3);

  return (
    <div className="product-page">
      <section className="home-section">
        <div className="home-inner">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href={`/?aisle=${product.category.slug}`}>{product.category.name}</Link>
            <span>/</span>
            <span aria-current="page">{product.title}</span>
          </nav>

          <div className="product-layout">
            <ProductGallery title={product.title} images={product.images || []} />
            <BuyBox
              title={product.title}
              category={product.category.name}
              description={product.description}
              currentSlug={product.slug}
              imageUrl={product.images?.find((image) => image.url)?.url}
              variants={product.variants || []}
              flavors={flavors}
              highlights={highlights}
              hasPassedReport={product.has_passed_report}
            />
          </div>
        </div>
      </section>

      {product.label ? (
        <section className="home-section">
          <div className="home-inner">
            <LabelChecked slug={product.slug} label={product.label} hasPassedReport={product.has_passed_report} />
          </div>
        </section>
      ) : null}

      {rail.length ? (
        <section className="home-section home-section--catalog">
          <div className="home-inner">
            <ProductRail id="also-passed" title="More that passed" count={rail.length}>
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
