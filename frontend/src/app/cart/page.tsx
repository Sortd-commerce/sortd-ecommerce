import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Cart = {
  items: Array<{
    id: number;
    title: string;
    sku: string;
    quantity: number;
    unit_price: string;
    line_total: string;
    available: boolean;
  }>;
  subtotal: string;
  currency: string;
};

export default async function CartPage() {
  const cart = await apiFetch<Cart>("/cart");

  if (cart.status === 401) {
    return (
      <div className="pt-8">
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-forest">Your cart</h1>
        <p className="mt-3 text-ink/70">
          <Link href="/login" className="text-citrus">
            Log in
          </Link>{" "}
          to view your cart.
        </p>
      </div>
    );
  }

  const items = cart.data?.items || [];

  return (
    <div className="space-y-6 pt-4">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-forest">Your cart</h1>
      <div className="card-quiet rounded-[1.8rem] divide-y divide-line">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 px-6 py-5">
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-ink/60">
                {item.sku} · qty {item.quantity}
                {!item.available ? " · unavailable" : ""}
              </p>
            </div>
            <p className="font-semibold text-forest">AED {item.line_total}</p>
          </div>
        ))}
        {!items.length ? <p className="px-6 py-8 text-ink/60">Cart is empty.</p> : null}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">Subtotal AED {cart.data?.subtotal || "0.00"}</p>
        {items.length ? (
          <Link href="/checkout" className="btn btn-primary">
            Checkout
          </Link>
        ) : (
          <Link href="/" className="btn btn-secondary">
            Continue shopping
          </Link>
        )}
      </div>
    </div>
  );
}
