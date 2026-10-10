import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DirhamIcon } from "@/components/DirhamIcon";
import { PageHeader } from "@/components/PageHeader";
import { updatePricingAction } from "@/lib/actions";
import { apiFetch } from "@/lib/api";
import { requireAdmin } from "@/lib/staff";

type PricingSettings = {
  delivery_fee: string;
  free_delivery_minimum: string;
  delivery_promise: string;
};

function normalizeDeliveryPromise(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text.toLowerCase() === "null" ? "" : text;
}

export default async function DeliveryConfigurationPage() {
  await requireAdmin();
  const pricing = await apiFetch<PricingSettings>("/admin/pricing");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Delivery configuration"
        description="Set customer-facing delivery pricing. Manage time slots, service areas, and discounts in their own sections."
      />

      <section className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-4">
          <h2 className="font-semibold">Free delivery</h2>
          <p className="mt-1 text-sm text-muted">
            Set the basket minimum for free delivery. Use 0 to turn off free-delivery messaging.
          </p>
        </div>
        <ActionForm action={updatePricingAction} className="grid gap-4 p-4 md:grid-cols-2" successLabel="Pricing updated.">
          <label className="field md:col-span-2">
            <span>Delivery promise</span>
            <input
              name="delivery_promise"
              type="text"
              maxLength={120}
              defaultValue={normalizeDeliveryPromise(pricing.data?.delivery_promise)}
              placeholder="Delivery in 30 minutes"
            />
            <span className="text-xs text-muted">Leave blank to hide this on the storefront.</span>
          </label>
          <label className="field">
            <span>Delivery fee (<DirhamIcon />)</span>
            <input name="delivery_fee" type="number" min="0" step="0.01" defaultValue={pricing.data?.delivery_fee || "0"} required />
          </label>
          <label className="field">
            <span>Free delivery from (<DirhamIcon />)</span>
            <input
              name="free_delivery_minimum"
              type="number"
              min="0"
              step="0.01"
              defaultValue={pricing.data?.free_delivery_minimum || "0"}
              required
            />
          </label>
          <SubmitButton className="md:col-span-2">Save delivery pricing</SubmitButton>
        </ActionForm>
      </section>

    </div>
  );
}
