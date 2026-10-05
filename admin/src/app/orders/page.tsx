import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { requireStaff } from "@/lib/staff";

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
  await requireStaff();
  const orders = await apiFetch<Orders>("/admin/orders");

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Every placed order. Open one to see the delivery window and lines." />
      <div className="panel overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Delivery</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(orders.data?.results || []).map((order) => (
              <tr key={order.number}>
                <td>
                  <Link href={`/orders/${order.number}`} className="font-medium text-accent hover:underline">
                    {order.number}
                  </Link>
                </td>
                <td>{order.user_email}</td>
                <td>
                  <StatusBadge value={order.status} />
                </td>
                <td>{order.delivery_date}</td>
                <td className="tabular-nums">AED {order.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.data?.results?.length ? <p className="px-4 py-10 text-sm text-muted">No orders yet.</p> : null}
      </div>
    </div>
  );
}
