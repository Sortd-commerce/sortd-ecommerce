import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Orders = {
  results: Array<{ number: string; status: string; total: string; delivery_date: string }>;
};

export default async function OrdersPage() {
  const orders = await apiFetch<Orders>("/orders");
  if (orders.status === 401) {
    return (
      <div className="pt-8">
        <Link href="/login" className="text-citrus">
          Log in
        </Link>{" "}
        to see orders.
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-forest">Your orders</h1>
      <div className="card-quiet divide-y divide-line rounded-[1.8rem]">
        {(orders.data?.results || []).map((order) => (
          <Link key={order.number} href={`/orders/${order.number}`} className="flex items-center justify-between px-6 py-5">
            <div>
              <p className="font-semibold">{order.number}</p>
              <p className="text-sm text-ink/60">
                {order.status} · {order.delivery_date}
              </p>
            </div>
            <p className="font-semibold text-forest">AED {order.total}</p>
          </Link>
        ))}
        {!orders.data?.results?.length ? <p className="px-6 py-8 text-ink/60">No orders yet.</p> : null}
      </div>
    </div>
  );
}
