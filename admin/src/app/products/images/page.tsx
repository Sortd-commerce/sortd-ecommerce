import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ProductImageSheetForm } from "@/components/ProductImageSheetForm";
import { requireAdmin } from "@/lib/staff";

export default async function ProductImageUploadPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product image uploader"
        description="Upload images in a separate, small batch so catalog imports stay focused on product data."
        actions={<Link href="/products" className="btn-ghost">Back to catalog</Link>}
      />
      <ProductImageSheetForm />
    </div>
  );
}
