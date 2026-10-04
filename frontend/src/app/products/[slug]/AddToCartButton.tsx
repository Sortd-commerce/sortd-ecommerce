"use client";

import { addToCartFormAction } from "@/lib/actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";

export function AddToCartButton({ variantId }: { variantId: number }) {
  return (
    <ActionForm action={addToCartFormAction} className="mt-6 grid gap-2">
      <input type="hidden" name="variant_id" value={variantId} />
      <SubmitButton className="btn btn-primary w-full" pendingLabel="Adding…">
        Add to cart
      </SubmitButton>
    </ActionForm>
  );
}
