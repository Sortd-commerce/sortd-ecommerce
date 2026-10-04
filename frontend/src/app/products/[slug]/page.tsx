import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyBox } from "@/app/products/[slug]/BuyBox";
import { LabelChecked } from "@/app/products/[slug]/LabelChecked";
import { ProductGallery } from "@/app/products/[slug]/ProductGallery";
import { apiFetch } from "@/lib/api";

type ProductDetail = {
  title: string;
  slug: string;
  description: string;
  has_passed_report: boolean;
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

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await apiFetch<ProductDetail>(`/products/${slug}`, { auth: false });
  if (!result.ok || !result.data) {
    notFound();
  }
  const product = result.data;

  return (
    <div className="space-y-10 pt-4">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="card-quiet overflow-hidden rounded-xl">
          <ProductGallery title={product.title} images={product.images || []} />
          <div className="p-8">
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-forest md:text-5xl">
              {product.title}
            </h1>
            <p className="mt-5 max-w-xl text-ink/75">{product.description || "Checked label. Honest stock."}</p>
            {product.has_passed_report ? (
              <Link href={`/products/${product.slug}/report`} className="mt-6 inline-flex text-sm font-semibold text-citrus">
                View lab report →
              </Link>
            ) : null}
          </div>
        </section>
        <BuyBox currentSlug={product.slug} variants={product.variants || []} related={product.related || []} />
      </div>
      {product.label ? (
        <LabelChecked slug={product.slug} label={product.label} hasPassedReport={product.has_passed_report} />
      ) : null}
    </div>
  );
}
