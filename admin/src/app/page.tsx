import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

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
  const overview = await apiFetch<Overview>("/admin/analytics/overview");
  if (overview.status === 401 || overview.status === 403) {
    redirect("/login");
  }

  const data = overview.data;

  return (
    <div className="space-y-8 pt-2">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-muted">Orders, stock pressure, and 30-day revenue.</p>
        </div>
        <Link href="/products/new" className="btn">
          New product
        </Link>
      </div>

      {!overview.ok ? <p className="text-warn">{overview.message}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Open orders", data?.orders_open ?? "—"],
          ["Revenue 30d", `AED ${data?.revenue_30d ?? "0.00"}`],
          ["Active products", data?.products_active ?? "—"],
          ["Customers", data?.customers ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="panel stat">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="font-semibold">Orders by status</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.entries(data?.by_status || {}).map(([status, count]) => (
              <li key={status} className="flex justify-between border-b border-line py-2">
                <span className="text-muted">{status}</span>
                <span>{count}</span>
              </li>
            ))}
            {!Object.keys(data?.by_status || {}).length ? <li className="text-muted">No orders yet.</li> : null}
          </ul>
        </div>
        <div className="panel p-5">
          <h2 className="font-semibold">Low stock</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {(data?.low_stock || []).map((row) => (
              <li key={row.sku} className="flex justify-between border-b border-line py-2">
                <span>
                  {row.product_title} <span className="text-muted">({row.sku})</span>
                </span>
                <span className="text-warn">{row.on_hand}</span>
              </li>
            ))}
            {!data?.low_stock?.length ? <li className="text-muted">No low-stock variants.</li> : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
