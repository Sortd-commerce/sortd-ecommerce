import Link from "next/link";
import { AddDiscountDrawer } from "@/components/AddDiscountDrawer";
import { DiscountEditor, type DiscountRow } from "@/components/DiscountEditor";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { requireAdmin } from "@/lib/staff";

type ProductOption = { id: number; title: string };

export default async function DeliveryDiscountsPage() {
  await requireAdmin();
  const [discountResult, productResult] = await Promise.all([
    apiFetch<DiscountRow[]>("/admin/discounts"),
    apiFetch<{ results: ProductOption[] }>("/admin/products?page_size=100"),
  ]);
  const discounts = (discountResult.data || []).filter((discount) => !discount.code);
  const products = (productResult.data?.results || []).map(({ id, title }) => ({ id, title }));
  const activeCount = discounts.filter((discount) => discount.is_active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discounts"
        description="Create automatic offers for the whole order or selected products. Promo-code offers are managed in Coupons."
        actions={<AddDiscountDrawer products={products} />}
      />

      {!discountResult.ok ? <p className="text-sm text-warn">{discountResult.message}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="panel p-4">
          <p className="text-sm text-muted">Automatic discounts</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{discounts.length}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-muted">Currently active</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">
            {activeCount}<StatusBadge value={activeCount ? "active" : "inactive"} />
          </p>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Automatic discounts</h2>
              <p className="mt-1 text-sm text-muted">Applied at checkout without entering a code.</p>
            </div>
            <Link href="/coupons" className="btn-ghost text-sm">Manage promo codes</Link>
          </div>
        </div>
        {discounts.length ? (
          <div className="overflow-x-auto">
            <table className="data-table min-w-225">
              <thead>
                <tr>
                  <th>Discount</th>
                  <th>Offer</th>
                  <th>Applies to</th>
                  <th>Minimum order</th>
                  <th>Status</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((discount) => (
                  <DiscountEditor key={discount.id} discount={discount} products={products} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <p className="font-medium">No automatic discounts yet</p>
            <p className="mt-1 text-sm text-muted">Use “Add discount” above to create an offer that applies at checkout.</p>
          </div>
        )}
      </section>
    </div>
  );
}
