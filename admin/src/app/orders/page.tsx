import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { ADMIN_PAGE_SIZE, pageFromParam, type Paginated } from "@/lib/pagination";
import { requireStaff } from "@/lib/staff";

type OrderRow = {
  number: string;
  status: string;
  total: string;
  delivery_date: string;
  user_email: string;
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireStaff();
  const { page: pageParam } = await searchParams;
  const page = pageFromParam(pageParam);
  const orders = await apiFetch<Paginated<OrderRow>>(
    `/admin/orders?page=${page}&page_size=${ADMIN_PAGE_SIZE}`,
  );
  const data = orders.data;

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
            {(data?.results || []).map((order) => (
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
        {!data?.results?.length ? <p className="px-4 py-10 text-sm text-muted">No orders yet.</p> : null}
        {data ? (
          <Pagination
            page={data.page}
            pages={data.pages}
            count={data.count}
            pageSize={data.page_size}
            basePath="/orders"
          />
        ) : null}
      </div>
    </div>
  );
}
