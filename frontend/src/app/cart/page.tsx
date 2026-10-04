"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export default function CartPage() {
  const { items, subtotal, setQuantity, removeItem } = useCart();

  return (
    <div className="space-y-6 pt-4">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-forest">Your cart</h1>
      <div className="card-quiet divide-y divide-line rounded-[1.8rem]">
        {items.map((item) => (
          <div key={item.variant_id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-ink/60">
                {item.sku} · AED {item.unit_price}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                Qty
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={item.quantity}
                  className="w-16 rounded-lg border border-line px-2 py-1"
                  onChange={(event) => setQuantity(item.variant_id, Number(event.target.value))}
                />
              </label>
              <button type="button" className="text-sm text-citrus" onClick={() => removeItem(item.variant_id)}>
                Remove
              </button>
              <p className="min-w-24 text-right font-semibold text-forest">
                AED {(Number(item.unit_price) * item.quantity).toFixed(2)}
              </p>
            </div>
          </div>
        ))}
        {!items.length ? <p className="px-6 py-8 text-ink/60">Cart is empty.</p> : null}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">Subtotal AED {subtotal}</p>
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
