import Link from "next/link";
import { CategoryAisleCard } from "@/components/CategoryAisleCard";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { requireAdmin } from "@/lib/staff";

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  image_url?: string | null;
};

export default async function CategoryAislesPage() {
  await requireAdmin();
  const categories = await apiFetch<CategoryRow[]>("/admin/categories");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aisle images"
        description="Hero images for each shop aisle on the storefront home page. Upload here or include an Aisles sheet in the Excel import."
        actions={
          <>
            <Link href="/products/import" className="btn-ghost">
              Import Excel
            </Link>
            <Link href="/products" className="btn-ghost">
              Back to catalog
            </Link>
          </>
        }
      />

      {!categories.ok ? (
        <p className="text-sm text-warn">{categories.message}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(categories.data || []).map((category) => (
            <CategoryAisleCard key={category.id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
