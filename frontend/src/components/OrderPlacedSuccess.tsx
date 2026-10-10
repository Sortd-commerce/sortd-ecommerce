"use client";

import Link from "next/link";
import { CheckCircle, Clock, MapPin, ShoppingBag } from "@phosphor-icons/react";
import { DirhamIcon } from "@/components/DirhamIcon";

export type OrderPlacedSummary = {
  number: string;
  subtotal: string;
  discount_amount: string;
  discount_code: string;
  delivery_fee: string;
  total: string;
  delivery_date: string;
  delivery_start: string;
  delivery_end: string;
  addressLine: string;
  itemCount: number;
};

function formatDeliveryWindow(date: string, start: string, end: string) {
  const day = date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Asia/Dubai",
      })
    : date;
  const from = start.slice(0, 5);
  const to = end.slice(0, 5);
  return `${day} · ${from}–${to}`;
}

export function OrderPlacedSuccess({ order }: { order: OrderPlacedSummary }) {
  const itemsLabel = order.itemCount === 1 ? "1 item" : `${order.itemCount} items`;

  return (
    <div className="order-placed" role="status" aria-live="polite">
      <div className="order-placed-hero">
        <span className="order-placed-icon-wrap" aria-hidden>
          <CheckCircle size={52} weight="fill" className="order-placed-icon" />
        </span>
        <p className="order-placed-kicker">Order placed</p>
        <h1 className="order-placed-title">Thanks — we&apos;re on it.</h1>
        <p className="order-placed-number">{order.number}</p>
      </div>

      <section className="order-placed-card" aria-label="Delivery summary">
        <div className="order-placed-row">
          <Clock size={20} weight="bold" aria-hidden className="order-placed-row-icon" />
          <div>
            <p className="order-placed-row-label">Delivery</p>
            <p className="order-placed-row-value">
              {formatDeliveryWindow(order.delivery_date, order.delivery_start, order.delivery_end)}
            </p>
          </div>
        </div>
        <div className="order-placed-row">
          <MapPin size={20} weight="bold" aria-hidden className="order-placed-row-icon" />
          <div>
            <p className="order-placed-row-label">Address</p>
            <p className="order-placed-row-value">{order.addressLine}</p>
          </div>
        </div>
        <div className="order-placed-total">
          <span>
            {itemsLabel} · Total
          </span>
          <strong><DirhamIcon /> {order.total}</strong>
        </div>
        {Number(order.discount_amount) > 0 ? (
          <p className="order-placed-row-value">
            Coupon {order.discount_code || "applied"} saved <DirhamIcon /> {order.discount_amount}
          </p>
        ) : null}
      </section>

      <p className="order-placed-footnote">Every item in this order passed all four gates.</p>

      <div className="order-placed-actions">
        <Link href="/" className="btn btn-primary order-placed-btn">
          <ShoppingBag size={18} weight="bold" aria-hidden />
          Continue shopping
        </Link>
        <Link href={`/orders/${order.number}`} className="btn btn-secondary order-placed-btn">
          View order details
        </Link>
      </div>
    </div>
  );
}
