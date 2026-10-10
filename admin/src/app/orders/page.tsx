import Link from "next/link";
import { ListToolbar } from "@/components/ListToolbar";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { apiListQuery, parseListQuery } from "@/lib/list-query";
import { ADMIN_PAGE_SIZE, pageFromParam, type Paginated } from "@/lib/pagination";
import { paymentMethodLabel } from "@/lib/payments";
import { requireStaff } from "@/lib/staff";

type OrderRow = {
  number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total: string;
  delivery_date: string;
  user_email: string;
};

const ORDER_SORTS = [
  { value: "created_at", label: "Placed date" },
  { value: "delivery_date", label: "Delivery date" },
  { value: "total", label: "Total" },
  { value: "status", label: "Status" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireStaff();
  const params = await searchParams;
  const query = parseListQuery(params);
  const page = pageFromParam(params.page);
  const orders = await apiFetch<Paginated<OrderRow>>(`/admin/orders?${apiListQuery(query, page, ADMIN_PAGE_SIZE)}`);
  const data = orders.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Every placed order. Open one to see the delivery window and lines." />
      <div className="panel overflow-hidden">
        <ListToolbar
          basePath="/orders"
          query={query}
          fields={[
            {
              kind: "search",
              name: "search",
              label: "Search",
              placeholder: "Order number or customer email",
            },
            {
              kind: "select",
              name: "status",
              label: "Status",
              options: [
                { value: "placed", label: "Placed" },
                { value: "confirmed", label: "Confirmed" },
                { value: "out_for_delivery", label: "Out for delivery" },
                { value: "delivered", label: "Delivered" },
                { value: "cancelled", label: "Cancelled" },
              ],
            },
            {
              kind: "select",
              name: "sort",
              label: "Sort by",
              emptyLabel: "Placed date",
              options: ORDER_SORTS,
            },
            {
              kind: "select",
              name: "order",
              label: "Order",
              emptyLabel: "Descending",
              options: [
                { value: "desc", label: "Descending" },
                { value: "asc", label: "Ascending" },
              ],
            },
          ]}
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Delivery</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(data?.results || []).map((order) => (
              <tr key={order.number}>
                <td>
                  <Link href={`/orders/${order.number}`} className="table-link">
                    {order.number}
                  </Link>
                </td>
                <td>{order.user_email}</td>
                <td>
                  <StatusBadge value={order.status} />
                </td>
                <td>
                  <div className="space-y-1">
                    <p className="text-sm">{paymentMethodLabel(order.payment_method)}</p>
                    <StatusBadge value={order.payment_status} />
                  </div>
                </td>
                <td>{order.delivery_date}</td>
                <td className="tabular-nums">د.إ {order.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.ok ? <p className="px-4 py-10 text-sm text-warn">{orders.message}</p> : null}
        {orders.ok && !data?.results?.length ? (
          <p className="px-4 py-10 text-sm text-muted">No orders match these filters.</p>
        ) : null}
        {data ? (
          <Pagination
            page={data.page}
            pages={data.pages}
            count={data.count}
            pageSize={data.page_size}
            basePath="/orders"
            query={query}
          />
        ) : null}
      </div>
    </div>
  );
}
