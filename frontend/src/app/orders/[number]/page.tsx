import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderCartClear } from "@/components/OrderCartClear";
import { apiFetch } from "@/lib/api";

type Order = {
  number: string;
  status: string;
  total: string;
  note: string;
  delivery_date: string;
  delivery_start: string;
  delivery_end: string;
  lines: Array<{ title: string; quantity: number; line_total: string }>;
  address: { formatted_address: string; line1: string; city: string };
};

export default async function OrderDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const result = await apiFetch<Order>(`/orders/${number}`);
  if (!result.ok || !result.data) {
    notFound();
  }
  const order = result.data;

  return (
    <div className="orders-page space-y-6">
      <OrderCartClear />
      <Link href="/orders" className="text-sm text-leaf">
        ← Orders
      </Link>
      <section className="card-quiet rounded-[1.8rem] p-6">
        <p className="text-sm uppercase tracking-[0.16em] text-citrus">{order.status}</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-forest">{order.number}</h1>
        <p className="mt-3 text-ink/70">
          Delivery {order.delivery_date} · {order.delivery_start.slice(0, 5)}–{order.delivery_end.slice(0, 5)}
        </p>
        <p className="mt-2 text-sm text-ink/60">{order.address.formatted_address || order.address.line1}</p>
        {order.note ? <p className="mt-3 text-sm">Note: {order.note}</p> : null}
      </section>
      <section className="card-quiet divide-y divide-line rounded-[1.8rem]">
        {order.lines.map((line) => (
          <div key={`${line.title}-${line.quantity}`} className="flex justify-between px-6 py-4">
            <p>
              {line.title} × {line.quantity}
            </p>
            <p className="font-semibold">AED {line.line_total}</p>
          </div>
        ))}
        <div className="flex justify-between px-6 py-4 font-semibold text-forest">
          <p>Total</p>
          <p>AED {order.total}</p>
        </div>
      </section>
    </div>
  );
}
