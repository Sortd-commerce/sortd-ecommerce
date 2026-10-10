import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderCartClear } from "@/components/OrderCartClear";
import { OrderPlacedSuccess } from "@/components/OrderPlacedSuccess";
import { DirhamIcon } from "@/components/DirhamIcon";
import { apiFetch } from "@/lib/api";
import { formatOrderStatus } from "@/lib/orders";

type Order = {
  number: string;
  status: string;
  total: string;
  note: string;
  created_at: string;
  delivery_date: string;
  delivery_start: string;
  delivery_end: string;
  lines: Array<{ title: string; quantity: number; line_total: string }>;
  address?: { formatted_address?: string; line1?: string; city?: string };
};

async function fetchOrder(number: string, attempts = 1) {
  const result = await apiFetch<Order>(`/orders/${number}`);
  if (result.ok && result.data) return result;
  if (attempts >= 4) return result;
  await new Promise((resolve) => setTimeout(resolve, 350));
  return fetchOrder(number, attempts + 1);
}

function formatOrderedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dubai",
  });
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Dubai",
  });
  return `${day} · ${time}`;
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { number } = await params;
  const { placed } = await searchParams;
  const justPlaced = placed === "1";
  const result = justPlaced ? await fetchOrder(number) : await apiFetch<Order>(`/orders/${number}`);
  if (!result.ok || !result.data) {
    notFound();
  }
  const order = result.data;
  const itemCount = (order.lines || []).reduce((sum, line) => sum + line.quantity, 0);
  const addressLine =
    order.address?.formatted_address || order.address?.line1 || order.address?.city || "Delivery address on file";

  if (justPlaced) {
    return (
      <div className="orders-page order-placed-page">
        <OrderCartClear />
        <OrderPlacedSuccess
          order={{
            number: order.number,
            total: order.total,
            delivery_date: order.delivery_date,
            delivery_start: order.delivery_start,
            delivery_end: order.delivery_end,
            addressLine,
            itemCount,
          }}
        />
      </div>
    );
  }

  return (
    <div className="orders-page space-y-6">
      <OrderCartClear />
      <Link href="/orders" className="text-sm text-leaf">
        ← Orders
      </Link>
      <section className="card-quiet rounded-[1.8rem] p-6">
        <p className="text-sm uppercase tracking-[0.16em] text-citrus">{formatOrderStatus(order.status)}</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-forest">{order.number}</h1>
        <p className="mt-3 text-ink/70">Ordered {formatOrderedAt(order.created_at)}</p>
        <p className="mt-1 text-ink/70">
          Delivery {order.delivery_date} · {order.delivery_start.slice(0, 5)}–{order.delivery_end.slice(0, 5)}
        </p>
        <p className="mt-2 text-sm text-ink/60">{addressLine}</p>
        {order.note ? <p className="mt-3 text-sm">Note: {order.note}</p> : null}
      </section>
      <section className="card-quiet divide-y divide-line rounded-[1.8rem]">
        {order.lines.map((line) => (
          <div key={`${line.title}-${line.quantity}`} className="flex justify-between px-6 py-4">
            <p>
              {line.title} × {line.quantity}
            </p>
            <p className="font-semibold"><DirhamIcon /> {line.line_total}</p>
          </div>
        ))}
        <div className="flex justify-between px-6 py-4 font-semibold text-forest">
          <p>Total</p>
          <p><DirhamIcon /> {order.total}</p>
        </div>
      </section>
    </div>
  );
}
