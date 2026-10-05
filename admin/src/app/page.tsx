import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { requireAdmin } from "@/lib/staff";

type Overview = {
  orders_total: number;
  orders_open: number;
  revenue_30d: string;
  products_active: number;
  customers: number;
  by_status: Record<string, number>;
  daily: Array<{ date: string | null; orders: number; revenue: string }>;
  low_stock: Array<{ sku: string; on_hand: number; product_title: string }>;
};

export default async function DashboardPage() {
  await requireAdmin();
  const overview = await apiFetch<Overview>("/admin/analytics/overview");
  const data = overview.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Open orders, 30-day revenue, and stock that needs a restock."
        actions={
          <Link href="/products/new" className="btn">
            New product
          </Link>
        }
      />

      {!overview.ok ? <p className="text-warn">{overview.message}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Open orders", data?.orders_open ?? "—"],
          ["Revenue 30d", `AED ${data?.revenue_30d ?? "0.00"}`],
          ["Active products", data?.products_active ?? "—"],
          ["Customers", data?.customers ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="font-semibold">Orders by status</h2>
          <ul className="mt-4 text-sm">
            {Object.entries(data?.by_status || {}).map(([status, count]) => (
              <li key={status} className="flex justify-between border-t border-line py-2.5 first:border-t-0">
                <span className="capitalize text-muted">{status.replaceAll("_", " ")}</span>
                <span className="tabular-nums">{count}</span>
              </li>
            ))}
            {!Object.keys(data?.by_status || {}).length ? <li className="text-muted">No orders yet.</li> : null}
          </ul>
        </div>
        <div className="panel p-5">
          <h2 className="font-semibold">Low stock</h2>
          <ul className="mt-4 text-sm">
            {(data?.low_stock || []).map((row) => (
              <li key={row.sku} className="flex justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
                <span>
                  {row.product_title} <span className="text-muted">({row.sku})</span>
                </span>
                <span className="tabular-nums text-warn">{row.on_hand}</span>
              </li>
            ))}
            {!data?.low_stock?.length ? <li className="text-muted">No low-stock variants.</li> : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
