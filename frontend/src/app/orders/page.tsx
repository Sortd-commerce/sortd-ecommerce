import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatOrderStatus } from "@/lib/orders";

type Orders = {
  results: Array<{ number: string; status: string; total: string; delivery_date: string }>;
};

export default async function OrdersPage() {
  const orders = await apiFetch<Orders>("/orders");
  if (orders.status === 401) {
    return (
      <div className="orders-page">
        <p className="orders-guest">
          <Link href="/?auth=login&next=/orders" className="text-action">
            Sign in
          </Link>{" "}
          to see orders.
        </p>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <h1 className="orders-title">Your orders</h1>
      <div className="orders-list card-quiet">
        {(orders.data?.results || []).map((order) => (
          <Link key={order.number} href={`/orders/${order.number}`} className="orders-row">
            <div>
              <p className="orders-row-number">{order.number}</p>
              <p className="orders-row-meta">
                {formatOrderStatus(order.status)} · {order.delivery_date}
              </p>
            </div>
            <p className="orders-row-total">د.إ {order.total}</p>
          </Link>
        ))}
        {!orders.data?.results?.length ? <p className="orders-empty">No orders yet.</p> : null}
      </div>
    </div>
  );
}
