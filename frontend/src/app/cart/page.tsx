"use client";

import Link from "next/link";
import { Trash } from "@phosphor-icons/react";
import { useCart } from "@/components/CartProvider";
import { QuantityStepper } from "@/components/QuantityStepper";
import { useToast } from "@/components/Toast";

export default function CartPage() {
  const { items, subtotal, setQuantity, removeItem } = useCart();
  const toast = useToast();

  return (
    <div className="space-y-8 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-forest md:text-5xl">Your cart</h1>
          <p className="mt-2 text-ink/65">{items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : "Nothing here yet"}</p>
        </div>
        {items.length ? (
          <Link href="/" className="link-quiet">
            Continue shopping
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="cart-panel divide-y divide-line">
          {items.map((item) => {
            const max = item.on_hand;
            const capped = max != null && item.quantity >= max;
            return (
              <div key={item.variant_id} className="cart-line">
                <div className="min-w-0 flex-1">
                  {item.slug ? (
                    <Link href={`/products/${item.slug}`} className="font-semibold text-forest hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    <p className="font-semibold">{item.title}</p>
                  )}
                  <p className="mt-1 text-sm text-ink/55">
                    {item.sku ? `${item.sku} · ` : ""}AED {item.unit_price}
                    {max != null ? ` · ${max} available` : ""}
                  </p>
                  {capped ? <p className="mt-1 text-xs font-medium text-citrus">Max stock reached</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <QuantityStepper
                    value={item.quantity}
                    max={max}
                    min={0}
                    size="sm"
                    onChange={(next) => {
                      if (next < 1) {
                        removeItem(item.variant_id);
                        return;
                      }
                      if (max != null && next > max) {
                        toast.error(`Only ${max} left in stock.`);
                        setQuantity(item.variant_id, max);
                        return;
                      }
                      setQuantity(item.variant_id, next);
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn text-citrus"
                    aria-label={`Remove ${item.title}`}
                    onClick={() => removeItem(item.variant_id)}
                  >
                    <Trash size={18} />
                  </button>
                  <p className="min-w-20 text-right font-semibold text-forest">
                    AED {(Number(item.unit_price) * item.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })}
          {!items.length ? (
            <div className="px-6 py-14 text-center">
              <p className="text-ink/65">Your cart is empty.</p>
              <Link href="/" className="btn btn-primary mt-5">
                Browse products
              </Link>
            </div>
          ) : null}
        </div>

        <aside className="cart-summary">
          <p className="text-sm font-medium text-ink/60">Order summary</p>
          <div className="mt-4 flex items-center justify-between text-lg font-semibold">
            <span>Subtotal</span>
            <span className="text-forest">AED {subtotal}</span>
          </div>
          <p className="mt-2 text-xs text-ink/50">Delivery fees calculated at checkout.</p>
          {items.length ? (
            <Link href="/checkout" className="btn btn-primary mt-6 w-full">
              Proceed to checkout
            </Link>
          ) : (
            <button type="button" className="btn btn-primary mt-6 w-full" disabled>
              Proceed to checkout
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
