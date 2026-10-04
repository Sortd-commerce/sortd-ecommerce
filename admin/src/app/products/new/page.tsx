import { redirect } from "next/navigation";
import { createCategoryAction, createProductAction } from "@/lib/actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { apiFetch } from "@/lib/api";

type Category = { id: number; name: string };
type ProductList = { results: Array<{ slug: string; title: string }> };

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const [categories, products] = await Promise.all([
    apiFetch<Category[]>("/admin/categories"),
    apiFetch<ProductList>("/admin/products?page_size=100"),
  ]);
  if (categories.status === 401 || categories.status === 403) redirect("/login");

  return (
    <div className="grid gap-6 pt-2 lg:grid-cols-[1.35fr_0.65fr]">
      <section>
        <h1 className="text-3xl font-semibold">New product</h1>
        <p className="mt-2 text-sm text-muted">
          One product per flavour. Pack of 5 / 2×5 are offers on this product. Link other flavours below.
        </p>
        {query.error ? <p className="mt-3 rounded-2xl bg-warn/10 px-4 py-3 text-sm text-warn">{query.error}</p> : null}
        <ActionForm action={createProductAction} className="panel mt-6 grid gap-6 p-6">
          <label className="field">
            <span>Title</span>
            <input name="title" required placeholder="20g Protein Bar, Coffee Cocoa" />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea name="description" rows={3} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span>Category</span>
              <select name="category_id" required>
                <option value="">Select category</option>
                {(categories.data || []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue="active">
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </label>
          </div>

          <div>
            <h2 className="font-semibold">Images</h2>
            <p className="mb-2 text-sm text-muted">First file in the picker is the primary photo. The rest follow in that order. You can select more than one.</p>
            <input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple />
          </div>

          <div>
            <h2 className="font-semibold">Pack offers</h2>
            <p className="mb-3 text-sm text-muted">Leave extra rows blank. Unit count is how many bars/items are in the SKU.</p>
            {[
              { sku: "", title: "Single bar", units: 1 },
              { sku: "", title: "Pack of 5", units: 5 },
              { sku: "", title: "2 packs of 5", units: 10 },
            ].map((offer, index) => (
              <div key={offer.title} className="mb-3 grid gap-2 sm:grid-cols-5">
                <label className="field">
                  <span>SKU {index + 1}</span>
                  <input name={`offer_sku_${index + 1}`} placeholder={index === 0 ? "required" : "optional"} required={index === 0} />
                </label>
                <label className="field">
                  <span>Title</span>
                  <input name={`offer_title_${index + 1}`} defaultValue={offer.title} />
                </label>
                <label className="field">
                  <span>AED</span>
                  <input name={`offer_price_${index + 1}`} defaultValue={index === 0 ? "16.90" : ""} />
                </label>
                <label className="field">
                  <span>Units</span>
                  <input name={`offer_units_${index + 1}`} type="number" min={1} defaultValue={offer.units} />
                </label>
                <label className="field">
                  <span>Stock</span>
                  <input name={`offer_stock_${index + 1}`} type="number" min={0} defaultValue={index === 0 ? 10 : 0} />
                </label>
              </div>
            ))}
          </div>

          <fieldset className="field">
            <span>Related flavours</span>
            <p className="text-xs text-muted">
              Other products that are flavours of this one. They show as flavour chips on the storefront.
            </p>
            <div className="mt-2 grid max-h-48 gap-2 overflow-auto rounded-xl border border-line p-3">
              {(products.data?.results || []).map((product) => (
                <label key={product.slug} className="flex items-center gap-3 text-sm text-text">
                  <input type="checkbox" name="related_slugs" value={product.slug} />
                  {product.title}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span>Serving basis</span>
              <input name="serving_basis" placeholder="PER BAR" />
            </label>
            <label className="field">
              <span>Serving size</span>
              <input name="serving_size" placeholder="67 g" />
            </label>
            <label className="field sm:col-span-2">
              <span>Headline</span>
              <input name="headline" placeholder="Protein-led. 20.3 g in every bar." />
            </label>
            <label className="field sm:col-span-2">
              <span>Facts — one per line: name|amount|unit|level|note|group|sub</span>
              <textarea
                name="facts"
                rows={6}
                placeholder={"Energy|341.7|kcal|||\nProtein|20.3|g|||\nof which sugars|11.9|g|medium|All from dates|Carbohydrate|sub"}
              />
            </label>
            <label className="field sm:col-span-2">
              <span>Ingredients — name|percent|detail</span>
              <textarea name="ingredients" rows={5} placeholder={"Cashews|35|\nDates|25|\nWhey protein|19|concentrate + isolate"} />
            </label>
            <label className="field sm:col-span-2">
              <span>Allergens — name|detail</span>
              <textarea name="allergens" rows={2} placeholder={"Tree nuts|cashews, almonds\nMilk|whey"} />
            </label>
            <label className="field">
              <span>Hidden sugars found</span>
              <input name="hidden_sugars_found" type="number" min={0} defaultValue={0} />
            </label>
            <label className="field">
              <span>Banned ingredients found</span>
              <input name="banned_ingredients_found" type="number" min={0} defaultValue={0} />
            </label>
            <label className="field">
              <span>Sugar source</span>
              <input name="sugar_source" placeholder="Coconut sugar, declared" />
            </label>
            <label className="field flex items-center gap-2 pt-6">
              <input name="shares_printed" type="checkbox" defaultChecked />
              <span>Ingredient shares printed on pack</span>
            </label>
            <label className="field sm:col-span-2">
              <span>Label note</span>
              <input name="label_note" placeholder="Potassium isn't listed on this pack." />
            </label>
            <label className="field sm:col-span-2">
              <span>Nutritionist note</span>
              <input name="nutritionist_note" placeholder="[To be written by Sortd]" />
            </label>
          </div>

          <SubmitButton pendingLabel="Creating…">Create product</SubmitButton>
        </ActionForm>
      </section>

      <section className="panel h-fit p-6">
        <h2 className="font-semibold">Quick category</h2>
        <ActionForm action={createCategoryAction} className="mt-4 grid gap-3" successLabel="Category created.">
          <label className="field">
            <span>Name</span>
            <input name="name" required autoComplete="off" />
          </label>
          <SubmitButton className="btn btn-ghost">Create category</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
