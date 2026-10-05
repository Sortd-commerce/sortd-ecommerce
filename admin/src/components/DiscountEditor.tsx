"use client";

import { deleteDiscountAction, updateDiscountAction } from "@/lib/actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";

export type DiscountRow = {
  id: number;
  name: string;
  kind: string;
  value: string;
  code: string;
  scope: string;
  product_id: number | null;
  product_title: string;
  is_active: boolean;
};

export function DiscountEditor({
  discount,
  products,
}: {
  discount: DiscountRow;
  products: Array<{ id: number; title: string }>;
}) {
  const scopeLabel =
    discount.scope === "all"
      ? "Global"
      : discount.scope === "product"
        ? discount.product_title || `Product #${discount.product_id}`
        : discount.scope;

  return (
    <li className="border-b border-line px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{discount.name}</p>
          <p className="mt-1 text-sm text-muted">
            {scopeLabel} · {discount.kind === "percent" ? `${discount.value}%` : `AED ${discount.value}`}
            {discount.code ? ` · Code ${discount.code}` : " · Automatic"}
          </p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          {discount.is_active ? "Active" : "Off"}
        </span>
      </div>
      <ActionForm action={updateDiscountAction} className="mt-3 grid gap-3 md:grid-cols-2">
        <input type="hidden" name="discount_id" value={discount.id} />
        <label className="field">
          <span>Name</span>
          <input name="name" defaultValue={discount.name} required />
        </label>
        <label className="field">
          <span>Kind</span>
          <select name="kind" defaultValue={discount.kind}>
            <option value="percent">Percent</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </label>
        <label className="field">
          <span>Value</span>
          <input name="value" type="number" min="0.01" step="0.01" defaultValue={discount.value} required />
        </label>
        <label className="field">
          <span>Scope</span>
          <select name="scope" defaultValue={discount.scope}>
            <option value="all">Global</option>
            <option value="product">Product</option>
          </select>
        </label>
        <label className="field">
          <span>Product</span>
          <select name="product_id" defaultValue={discount.product_id || ""}>
            <option value="">None</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Promo code</span>
          <input name="code" defaultValue={discount.code} placeholder="Leave blank for automatic" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted md:col-span-2">
          <input name="is_active" type="checkbox" defaultChecked={discount.is_active} /> Active
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <SubmitButton>Save discount</SubmitButton>
        </div>
      </ActionForm>
      <form action={deleteDiscountAction} className="mt-2">
        <input type="hidden" name="discount_id" value={discount.id} />
        <button type="submit" className="text-sm font-semibold text-citrus">
          Remove
        </button>
      </form>
    </li>
  );
}
