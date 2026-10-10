import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AddZoneDrawer } from "@/components/AddZoneDrawer";
import { DiscountEditor, type DiscountRow } from "@/components/DiscountEditor";
import { PageHeader } from "@/components/PageHeader";
import { DeliveryZoneRow, ZoneEditor } from "@/components/ZoneEditor";
import { WindowEditor, type DeliveryWindowRow } from "@/components/WindowEditor";
import { createDiscountAction, createWindowAction, updatePricingAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";
import { requireAdmin } from "@/lib/staff";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function normalizeDeliveryPromise(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text.toLowerCase() === "null" ? "" : text;
}

type PricingSettings = {
  delivery_fee: string;
  free_delivery_minimum: string;
  delivery_promise: string;
};

type ProductOption = {
  id: number;
  title: string;
};

export default async function DeliveryAdminPage() {
  await requireAdmin();
  const [windows, zones, pricing, discounts, products] = await Promise.all([
    apiFetch<DeliveryWindowRow[]>("/admin/delivery/windows"),
    apiFetch<DeliveryZoneRow[]>("/admin/delivery/zones"),
    apiFetch<PricingSettings>("/admin/pricing"),
    apiFetch<DiscountRow[]>("/admin/discounts"),
    apiFetch<{ results: ProductOption[] }>("/admin/products?page_size=100"),
  ]);
  const productOptions = (products.data?.results || []).map((row) => ({ id: row.id, title: row.title }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Delivery & pricing"
        description="Delivery zones, weekly windows, free-delivery threshold, and automatic discounts. Promo codes live under Coupons."
      />

      <section className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-4">
          <h2 className="font-semibold">Free delivery</h2>
          <p className="mt-1 text-sm text-muted">
            Customers see how much more to add for free delivery. Set the minimum to 0 to hide free-delivery messaging.
          </p>
        </div>
        <ActionForm action={updatePricingAction} className="grid gap-3 p-4 md:grid-cols-2" successLabel="Pricing updated.">
          <label className="field md:col-span-2">
            <span>Delivery promise</span>
            <input
              name="delivery_promise"
              type="text"
              maxLength={120}
              defaultValue={normalizeDeliveryPromise(pricing.data?.delivery_promise)}
              placeholder="Delivery in 30 minutes"
            />
            <span className="text-xs text-muted">Leave blank to hide this on the storefront.</span>
          </label>
          <label className="field">
            <span>Delivery fee (د.إ)</span>
            <input name="delivery_fee" type="number" min="0" step="0.01" defaultValue={pricing.data?.delivery_fee || "0"} required />
          </label>
          <label className="field">
            <span>Free delivery from (د.إ)</span>
            <input
              name="free_delivery_minimum"
              type="number"
              min="0"
              step="0.01"
              defaultValue={pricing.data?.free_delivery_minimum || "0"}
              required
            />
          </label>
          <SubmitButton className="md:col-span-2">Save pricing</SubmitButton>
        </ActionForm>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-4">
          <h2 className="font-semibold">Automatic discounts</h2>
          <p className="mt-1 text-sm text-muted">
            Leave the promo code blank. These apply without a code at checkout. For WELCOME10-style offers, use{" "}
            <a href="/coupons" className="text-accent underline underline-offset-2">
              Coupons
            </a>
            .
          </p>
        </div>
        <ul>
          {(discounts.data || [])
            .filter((row) => !row.code)
            .map((row) => (
              <DiscountEditor key={row.id} discount={row} products={productOptions} />
            ))}
          {!discounts.data?.filter((row) => !row.code).length ? (
            <li className="px-4 py-8 text-sm text-muted">No automatic discounts yet.</li>
          ) : null}
        </ul>
        <div className="border-t border-line p-4">
          <h3 className="text-sm font-medium">Add automatic discount</h3>
          <ActionForm action={createDiscountAction} className="mt-3 grid gap-3 md:grid-cols-2" successLabel="Discount added.">
            <input type="hidden" name="redirect_to" value="/delivery" />
            <label className="field">
              <span>Name</span>
              <input name="name" placeholder="Summer sale" required />
            </label>
            <label className="field">
              <span>Kind</span>
              <select name="kind" defaultValue="percent">
                <option value="percent">Percent</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>
            <label className="field">
              <span>Value</span>
              <input name="value" type="number" min="0.01" step="0.01" defaultValue="10" required />
            </label>
            <label className="field">
              <span>Scope</span>
              <select name="scope" defaultValue="all">
                <option value="all">Global</option>
                <option value="product">Product</option>
              </select>
            </label>
            <label className="field">
              <span>Product</span>
              <select name="product_id" defaultValue="">
                <option value="">None</option>
                {productOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Promo code</span>
              <input name="code" placeholder="Optional" />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted md:col-span-2">
              <input name="is_active" type="checkbox" defaultChecked /> Active
            </label>
            <SubmitButton className="md:col-span-2">Add discount</SubmitButton>
          </ActionForm>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-4">
            <h2 className="font-semibold">Weekly windows</h2>
            <p className="mt-1 text-sm text-muted">Customers pick from open capacity on these days.</p>
          </div>
          <ul>
            {(windows.data || []).map((row) => (
              <WindowEditor key={row.id} window={row} />
            ))}
            {!windows.data?.length ? <li className="px-4 py-8 text-sm text-muted">No windows yet.</li> : null}
          </ul>
          <div className="border-t border-line p-4">
            <h3 className="text-sm font-medium">Add window</h3>
            <ActionForm action={createWindowAction} className="mt-3 grid gap-3" successLabel="Window added.">
              <label className="field">
                <span>Weekday</span>
                <select name="weekday" defaultValue={0}>
                  {WEEKDAYS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>Start</span>
                  <input name="start_time" type="time" defaultValue="09:00" required />
                </label>
                <label className="field">
                  <span>End</span>
                  <input name="end_time" type="time" defaultValue="12:00" required />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>Capacity</span>
                  <input name="capacity" type="number" min={1} defaultValue={20} required />
                </label>
                <label className="field">
                  <span>Cutoff minutes</span>
                  <input name="cutoff_minutes" type="number" min={0} defaultValue={60} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input name="is_active" type="checkbox" defaultChecked /> Active
              </label>
              <SubmitButton>Add window</SubmitButton>
            </ActionForm>
          </div>
        </div>

        <div className="panel overflow-hidden xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4">
            <div>
              <h2 className="font-semibold">Delivery zones</h2>
              <p className="mt-1 text-sm text-muted">
                Serviceability is based on the customer&apos;s location pin inside these polygons. Enable the zones you deliver to, or draw new ones on the map.
              </p>
            </div>
            <AddZoneDrawer />
          </div>
          <ul>
            {(zones.data || []).map((row) => (
              <ZoneEditor key={row.id} zone={row} />
            ))}
            {!zones.data?.length ? (
              <li className="px-4 py-8 text-sm text-muted">No delivery zones yet. The reference Dubai zones are seeded on migration.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
