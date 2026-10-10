import Link from "next/link";
import { CatalogImportForm } from "@/components/CatalogImportForm";
import { PageHeader } from "@/components/PageHeader";
import { requireAdmin } from "@/lib/staff";

export default async function CatalogImportPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import catalog"
        description="Upload the Sortd product listing workbook. Product data is imported separately from image uploads."
        actions={
          <Link href="/products" className="btn-ghost">
            Back to catalog
          </Link>
        }
      />

      <section className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-4">
          <h2 className="font-semibold">Excel workbook</h2>
          <p className="mt-1 text-sm text-muted">
            Use the Launch range sheet for product data. Main image, gallery, aisle image, and lab report URL columns are not processed during this import. Upload product images separately from Catalog → Image uploader; it accepts up to 10 image rows and returns an output CSV with stored image URLs.
          </p>
          <Link href="/products/images" className="mt-3 inline-flex text-sm text-accent underline underline-offset-2">
            Open product image uploader
          </Link>
        </div>
        <div className="space-y-4 p-4">
          <CatalogImportForm />
          <div className="rounded-xl border border-line bg-panel-2 p-4 text-sm text-muted">
            <p className="font-medium text-text">Before importing client data</p>
            <p className="mt-2">
              Clear dummy catalog data from the backend with{" "}
              <code className="rounded bg-panel px-1.5 py-0.5 text-xs text-text">python src/manage.py clear_catalog_data --yes</code>.
              User accounts are kept.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
