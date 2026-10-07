import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOrderStatusAction } from "@/lib/actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/payments";
import { requireStaff } from "@/lib/staff";

type Order = {
  number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total: string;
  user_email: string;
  note: string;
  delivery_date: string;
  delivery_start: string;
  delivery_end: string;
  lines: Array<{ title: string; sku: string; quantity: number; line_total: string }>;
  address: { formatted_address: string; line1: string; city: string };
};

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const me = await requireStaff();
  const { number } = await params;
  const result = await apiFetch<Order>(`/admin/orders/${number}`);
  if (!result.ok || !result.data) notFound();
  const order = result.data;
  const canEdit = me.role === "admin" && order.status !== "cancelled" && order.status !== "delivered";

  return (
    <div className="space-y-6">
      <Link href="/orders" className="text-sm text-muted hover:text-text">
        Back to orders
      </Link>
      <PageHeader
        title={order.number}
        description={order.user_email}
        actions={<StatusBadge value={order.status} />}
      />

      {canEdit ? (
        <ActionForm action={updateOrderStatusAction} className="panel flex flex-wrap items-end gap-3 p-4" successLabel="Status updated.">
          <input type="hidden" name="number" value={order.number} />
          <label className="field">
            <span>Update status</span>
            <select name="status" defaultValue={order.status === "placed" ? "confirmed" : order.status}>
              <option value="confirmed">Confirmed</option>
              <option value="out_for_delivery">Out for delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <SubmitButton>Save status</SubmitButton>
        </ActionForm>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-semibold">Payment</h2>
          <p className="mt-3 text-sm">{paymentMethodLabel(order.payment_method)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge value={order.payment_status} />
            <span className="text-sm text-muted">{paymentStatusLabel(order.payment_status)}</span>
          </div>
        </section>
        <section className="panel p-5">
          <h2 className="font-semibold">Delivery</h2>
          <p className="mt-3 text-sm text-muted">
            {order.delivery_date} · {order.delivery_start.slice(0, 5)}–{order.delivery_end.slice(0, 5)}
          </p>
          <p className="mt-2 text-sm">{order.address.formatted_address || `${order.address.line1}, ${order.address.city}`}</p>
          {order.note ? <p className="mt-3 text-sm text-warn">Note: {order.note}</p> : null}
        </section>
        <section className="panel divide-y divide-line lg:col-span-2">
          {order.lines.map((line) => (
            <div key={`${line.sku}-${line.quantity}`} className="flex justify-between px-5 py-4 text-sm">
              <div>
                <p>{line.title}</p>
                <p className="text-muted">
                  {line.sku} × {line.quantity}
                </p>
              </div>
              <p className="tabular-nums">AED {line.line_total}</p>
            </div>
          ))}
          <div className="flex justify-between px-5 py-4 font-semibold">
            <p>Total</p>
            <p className="tabular-nums">AED {order.total}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
