import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Orders = {
  results: Array<{
    number: string;
    status: string;
    total: string;
    delivery_date: string;
    user_email: string;
  }>;
};

export default async function AdminOrdersPage() {
  const orders = await apiFetch<Orders>("/admin/orders");
  if (orders.status === 401 || orders.status === 403) redirect("/login");

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-3xl font-semibold">Orders</h1>
      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel-2 text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Delivery</th>
              <th className="px-4 py-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {(orders.data?.results || []).map((order) => (
              <tr key={order.number} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link href={`/orders/${order.number}`} className="text-accent">
                    {order.number}
                  </Link>
                </td>
                <td className="px-4 py-3">{order.user_email}</td>
                <td className="px-4 py-3">{order.status}</td>
                <td className="px-4 py-3">{order.delivery_date}</td>
                <td className="px-4 py-3">AED {order.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.data?.results?.length ? <p className="px-4 py-8 text-muted">No orders yet.</p> : null}
      </div>
    </div>
  );
}
