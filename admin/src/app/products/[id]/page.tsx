import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  addOfferAction,
  updateOfferAction,
  updateProductAction,
  uploadProductImageAction,
} from "@/lib/actions";
import { apiFetch } from "@/lib/api";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ProductImageGallery } from "@/components/ProductImageGallery";

type Product = {
  id: number;
  title: string;
  slug: string;
  description: string;
  status: string;
  category: { id: number; name: string };
  images: Array<{
    id: number;
    url: string;
    alt: string;
    role: string;
    original_name: string;
    byte_size: number;
    created_at: string | null;
  }>;
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
  related: Array<{ slug: string; title: string; kind: string }>;
  label: {
    serving_size: string;
    serving_basis: string;
    headline: string;
    note: string;
    nutritionist_note: string;
    sugar_source: string;
    hidden_sugars_found: number;
    banned_ingredients_found: number;
    shares_printed: boolean;
    facts: Array<{ name: string; amount: string; unit: string; level: string; note: string; group: string; is_subfact: boolean }>;
    ingredients: Array<{ name: string; share_percent: string | null; detail: string }>;
    allergens: Array<{ name: string; detail: string }>;
  } | null;
};

type Category = { id: number; name: string };
type ProductList = { results: Array<{ slug: string; title: string }> };

function factsText(product: Product) {
  return (product.label?.facts || [])
    .map((row) => [row.name, row.amount, row.unit, row.level, row.note, row.group, row.is_subfact ? "sub" : ""].join("|"))
    .join("\n");
}

function ingredientsText(product: Product) {
  return (product.label?.ingredients || [])
    .map((row) => [row.name, row.share_percent || "", row.detail].join("|"))
    .join("\n");
}

function allergensText(product: Product) {
  return (product.label?.allergens || []).map((row) => [row.name, row.detail].join("|")).join("\n");
}

export default async function AdminProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [productResult, categories, catalog] = await Promise.all([
    apiFetch<Product>(`/admin/products/${id}`),
    apiFetch<Category[]>("/admin/categories"),
    apiFetch<ProductList>("/admin/products?page_size=100"),
  ]);
  if (productResult.status === 401 || productResult.status === 403) redirect("/login");
  if (!productResult.ok || !productResult.data) notFound();
  const product = productResult.data;
  const selectedRelated = new Set((product.related || []).map((row) => row.slug));

  return (
    <div className="space-y-6 pt-2">
      <Link href="/products" className="text-sm text-muted">
        ← Products
      </Link>
      <h1 className="text-3xl font-semibold">{product.title}</h1>
      {query.error ? <p className="rounded-2xl bg-warn/10 px-4 py-3 text-sm text-warn">{query.error}</p> : null}

      <ActionForm action={updateProductAction} className="panel grid gap-4 p-6" successLabel="Product saved.">
        <input type="hidden" name="product_id" value={product.id} />
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="field">
            <span>Title</span>
            <input name="title" defaultValue={product.title} required />
          </label>
          <label className="field">
            <span>Category</span>
            <select name="category_id" defaultValue={String(product.category.id)}>
              {(categories.data || []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Description</span>
          <textarea name="description" rows={3} defaultValue={product.description} />
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" defaultValue={product.status}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <fieldset className="field">
          <span>Related flavours</span>
          <p className="text-xs text-muted">
            Other products that are flavours of this one. They show as flavour chips on the storefront.
          </p>
          <div className="mt-2 grid max-h-48 gap-2 overflow-auto rounded-xl border border-line p-3">
            {(catalog.data?.results || [])
              .filter((row) => row.slug !== product.slug)
              .map((row) => (
                <label key={row.slug} className="flex items-center gap-3 text-sm text-text">
                  <input
                    type="checkbox"
                    name="related_slugs"
                    value={row.slug}
                    defaultChecked={selectedRelated.has(row.slug)}
                  />
                  {row.title}
                </label>
              ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span>Serving basis</span>
            <input name="serving_basis" defaultValue={product.label?.serving_basis || ""} />
          </label>
          <label className="field">
            <span>Serving size</span>
            <input name="serving_size" defaultValue={product.label?.serving_size || ""} />
          </label>
          <label className="field sm:col-span-2">
            <span>Headline</span>
            <input name="headline" defaultValue={product.label?.headline || ""} />
          </label>
          <label className="field sm:col-span-2">
            <span>Facts — name|amount|unit|level|note|group|sub</span>
            <textarea name="facts" rows={7} defaultValue={factsText(product)} />
          </label>
          <label className="field sm:col-span-2">
            <span>Ingredients — name|percent|detail</span>
            <textarea name="ingredients" rows={6} defaultValue={ingredientsText(product)} />
          </label>
          <label className="field sm:col-span-2">
            <span>Allergens — name|detail</span>
            <textarea name="allergens" rows={2} defaultValue={allergensText(product)} />
          </label>
          <label className="field">
            <span>Hidden sugars found</span>
            <input name="hidden_sugars_found" type="number" min={0} defaultValue={product.label?.hidden_sugars_found || 0} />
          </label>
          <label className="field">
            <span>Banned ingredients found</span>
            <input
              name="banned_ingredients_found"
              type="number"
              min={0}
              defaultValue={product.label?.banned_ingredients_found || 0}
            />
          </label>
          <label className="field">
            <span>Sugar source</span>
            <input name="sugar_source" defaultValue={product.label?.sugar_source || ""} />
          </label>
          <label className="field flex items-center gap-2 pt-6">
            <input name="shares_printed" type="checkbox" defaultChecked={product.label?.shares_printed !== false} />
            <span>Ingredient shares printed on pack</span>
          </label>
          <label className="field sm:col-span-2">
            <span>Label note</span>
            <input name="label_note" defaultValue={product.label?.note || ""} />
          </label>
          <label className="field sm:col-span-2">
            <span>Nutritionist note</span>
            <input name="nutritionist_note" defaultValue={product.label?.nutritionist_note || ""} />
          </label>
        </div>
        <SubmitButton>Save product</SubmitButton>
      </ActionForm>

      <section className="panel grid gap-4 p-6">
        <h2 className="font-semibold">Pack offers</h2>
        <div className="grid gap-3">
          {product.variants.map((variant) => (
            <ActionForm
              key={variant.id}
              action={updateOfferAction}
              className="grid gap-2 rounded-xl border border-line p-4 sm:grid-cols-6 sm:items-end"
              successLabel="Offer saved."
            >
              <input type="hidden" name="variant_id" value={variant.id} />
              <input type="hidden" name="product_id" value={product.id} />
              <label className="field sm:col-span-2">
                <span>{variant.sku}</span>
                <input name="title" defaultValue={variant.title} required />
              </label>
              <label className="field">
                <span>AED</span>
                <input name="price" defaultValue={variant.price} required />
              </label>
              <label className="field">
                <span>Was</span>
                <input name="compare_at_price" defaultValue={variant.compare_at_price || ""} />
              </label>
              <label className="field">
                <span>Units</span>
                <input name="unit_count" type="number" min={1} defaultValue={variant.unit_count} />
              </label>
              <label className="field">
                <span>On hand</span>
                <input name="on_hand" type="number" min={0} defaultValue={variant.on_hand} required />
              </label>
              <label className="field flex items-center gap-2 sm:col-span-4">
                <input name="is_active" type="checkbox" defaultChecked={variant.is_active} />
                <span>Active offer</span>
              </label>
              <SubmitButton className="btn btn-ghost sm:col-span-2">Save offer</SubmitButton>
            </ActionForm>
          ))}
        </div>
        <ActionForm action={addOfferAction} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-6 sm:items-end" successLabel="Offer added.">
          <input type="hidden" name="product_id" value={product.id} />
          <label className="field">
            <span>SKU</span>
            <input name="sku" required />
          </label>
          <label className="field">
            <span>Title</span>
            <input name="title" placeholder="Pack of 5" required />
          </label>
          <label className="field">
            <span>Price</span>
            <input name="price" required />
          </label>
          <label className="field">
            <span>Units</span>
            <input name="unit_count" type="number" min={1} defaultValue={5} />
          </label>
          <label className="field">
            <span>Stock</span>
            <input name="on_hand" type="number" min={0} defaultValue={0} />
          </label>
          <SubmitButton>Add offer</SubmitButton>
        </ActionForm>
      </section>

      <section className="panel grid gap-4 p-6">
        <h2 className="text-pretty font-semibold">Product images</h2>
        <p className="text-sm text-muted">
          First in the list is the primary storefront photo. Click a row to view it full screen. Drag the handle, or
          focus it and use Arrow Up / Arrow Down, to reorder.
        </p>
        <ProductImageGallery productId={product.id} productTitle={product.title} images={product.images || []} />
        <ActionForm action={uploadProductImageAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="product_id" value={product.id} />
          <label className="field">
            <span>Files</span>
            <input name="files" type="file" accept="image/jpeg,image/png,image/webp" multiple required />
          </label>
          <SubmitButton pendingLabel="Uploading…">Upload images</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
