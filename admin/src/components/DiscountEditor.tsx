"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DirhamIcon } from "@/components/DirhamIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { deleteDiscountAction, updateDiscountAction } from "@/lib/actions";

export type DiscountRow = {
  id: number;
  name: string;
  headline: string;
  detail: string;
  kind: string;
  benefit: string;
  value: string;
  code: string;
  scope: string;
  product_id: number | null;
  product_title: string;
  minimum_order: string;
  max_discount: string;
  first_order_only: boolean;
  is_active: boolean;
};

export function DiscountEditor({
  discount,
  products,
}: {
  discount: DiscountRow;
  products: Array<{ id: number; title: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const scopeLabel = discount.scope === "all" ? "Entire order" : discount.product_title || `Product #${discount.product_id}`;
  const valueLabel = discount.kind === "percent" ? `${discount.value}% off` : <><DirhamIcon /> {discount.value} off</>;

  return (
    <>
      <tr>
        <td>
          <p className="font-medium">{discount.name}</p>
          <p className="mt-0.5 text-xs text-muted">{discount.first_order_only ? "First order only" : "All customers"}</p>
        </td>
        <td className="whitespace-nowrap">{valueLabel}</td>
        <td>{scopeLabel}</td>
        <td className="whitespace-nowrap">{discount.minimum_order && Number(discount.minimum_order) > 0 ? <><DirhamIcon /> {discount.minimum_order} minimum</> : "No minimum"}</td>
        <td><StatusBadge value={discount.is_active ? "active" : "inactive"} /></td>
        <td className="text-right">
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost text-sm" onClick={() => setEditing((value) => !value)}>
              {editing ? "Close" : "Edit"}
            </button>
            <form action={deleteDiscountAction}>
              <input type="hidden" name="discount_id" value={discount.id} />
              <input type="hidden" name="redirect_to" value="/delivery/discounts" />
              <button type="submit" className="btn-danger text-sm">Remove</button>
            </form>
          </div>
        </td>
      </tr>
      {editing ? (
        <tr>
          <td colSpan={6} className="bg-panel-2/50">
            <ActionForm action={updateDiscountAction} className="grid gap-4 p-2 md:grid-cols-2" successLabel="Discount saved.">
              <input type="hidden" name="discount_id" value={discount.id} />
              <input type="hidden" name="redirect_to" value="/delivery/discounts" />
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
                  {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Minimum order</span>
                <input name="minimum_order" type="number" min="0" step="0.01" defaultValue={discount.minimum_order || ""} />
              </label>
              <label className="field">
                <span>Maximum discount</span>
                <input name="max_discount" type="number" min="0" step="0.01" defaultValue={discount.max_discount || ""} />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input name="first_order_only" type="checkbox" defaultChecked={discount.first_order_only} /> First order only
              </label>
              <label className="flex items-center gap-2 text-sm text-muted md:col-span-2">
                <input name="is_active" type="checkbox" defaultChecked={discount.is_active} /> Active
              </label>
              <div className="flex gap-2 md:col-span-2">
                <SubmitButton>Save discount</SubmitButton>
                <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </ActionForm>
          </td>
        </tr>
      ) : null}
    </>
  );
}
