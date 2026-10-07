import { CouponsPanel } from "@/components/CouponsPanel";
import type { DiscountRow } from "@/components/DiscountEditor";
import { apiFetch } from "@/lib/api";
import { requireAdmin } from "@/lib/staff";

export default async function CouponsAdminPage() {
  await requireAdmin();
  const discounts = await apiFetch<DiscountRow[]>("/admin/discounts");
  const coupons = (discounts.data || []).filter((row) => row.code);

  return (
    <div className="space-y-8">
      <CouponsPanel coupons={coupons} />
    </div>
  );
}
