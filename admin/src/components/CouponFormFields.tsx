import type { DiscountRow } from "@/components/DiscountEditor";
import { DirhamIcon } from "@/components/DirhamIcon";

export function CouponFormFields({ coupon }: { coupon?: DiscountRow }) {
  return (
    <>
      <input type="hidden" name="redirect_to" value="/coupons" />
      <input type="hidden" name="scope" value="all" />
      {coupon ? <input type="hidden" name="discount_id" value={coupon.id} /> : null}
      <label className="field">
        <span>Internal name</span>
        <input name="name" defaultValue={coupon?.name} placeholder="Welcome offer" required />
      </label>
      <label className="field">
        <span>Promo code</span>
        <input name="code" defaultValue={coupon?.code} placeholder="WELCOME10" required />
      </label>
      <label className="field sm:col-span-2">
        <span>Checkout headline</span>
        <input
          name="headline"
          defaultValue={coupon?.headline}
          placeholder="10% off your first order"
        />
      </label>
      <label className="field sm:col-span-2">
        <span>Checkout detail</span>
        <input
          name="detail"
          defaultValue={coupon?.detail}
          placeholder="Up to AED 30 off · first order only"
        />
      </label>
      <label className="field">
        <span>Benefit</span>
        <select name="benefit" defaultValue={coupon?.benefit || "merchandise"}>
          <option value="merchandise">Merchandise discount</option>
          <option value="free_delivery">Free delivery</option>
        </select>
      </label>
      <label className="field">
        <span>Kind</span>
        <select name="kind" defaultValue={coupon?.kind || "percent"}>
          <option value="percent">Percent</option>
          <option value="fixed">Fixed amount</option>
        </select>
      </label>
      <label className="field">
        <span>Value</span>
        <input
          name="value"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={coupon?.value || "10"}
          required
        />
      </label>
      <label className="field">
        <span>Minimum order (<DirhamIcon />)</span>
        <input
          name="minimum_order"
          type="number"
          min="0"
          step="0.01"
          defaultValue={coupon?.minimum_order || ""}
          placeholder="60"
        />
      </label>
      <label className="field">
        <span>Max discount (<DirhamIcon />)</span>
        <input
          name="max_discount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={coupon?.max_discount || ""}
          placeholder="30"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
        <input name="first_order_only" type="checkbox" defaultChecked={coupon?.first_order_only} /> First order only
      </label>
      <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
        <input name="is_active" type="checkbox" defaultChecked={coupon?.is_active ?? true} /> Active
      </label>
    </>
  );
}
