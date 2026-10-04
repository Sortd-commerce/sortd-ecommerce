import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateOrderStatusAction } from "@/lib/actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { apiFetch } from "@/lib/api";

type Order = {
  number: string;
  status: string;
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
  const { number } = await params;
  const result = await apiFetch<Order>(`/admin/orders/${number}`);
  if (result.status === 401 || result.status === 403) redirect("/login");
  if (!result.ok || !result.data) notFound();
  const order = result.data;

  return (
    <div className="space-y-6 pt-2">
      <Link href="/orders" className="text-sm text-muted">
        ← Orders
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{order.number}</h1>
          <p className="mt-1 text-muted">
            {order.user_email} · {order.status}
          </p>
        </div>
        <ActionForm action={updateOrderStatusAction} className="panel flex items-end gap-3 p-4" successLabel="Status updated.">
          <input type="hidden" name="number" value={order.number} />
          <label className="field">
            <span>Update status</span>
            <select name="status" defaultValue={order.status === "placed" ? "confirmed" : order.status}>
              <option value="confirmed">confirmed</option>
              <option value="out_for_delivery">out_for_delivery</option>
              <option value="delivered">delivered</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-semibold">Delivery</h2>
          <p className="mt-3 text-sm text-muted">
            {order.delivery_date} · {order.delivery_start.slice(0, 5)}–{order.delivery_end.slice(0, 5)}
          </p>
          <p className="mt-2 text-sm">{order.address.formatted_address || `${order.address.line1}, ${order.address.city}`}</p>
          {order.note ? <p className="mt-3 text-sm text-warn">Note: {order.note}</p> : null}
        </section>
        <section className="panel divide-y divide-line">
          {order.lines.map((line) => (
            <div key={`${line.sku}-${line.quantity}`} className="flex justify-between px-5 py-4 text-sm">
              <div>
                <p>{line.title}</p>
                <p className="text-muted">
                  {line.sku} × {line.quantity}
                </p>
              </div>
              <p>AED {line.line_total}</p>
            </div>
          ))}
          <div className="flex justify-between px-5 py-4 font-semibold">
            <p>Total</p>
            <p>AED {order.total}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
