import { TableSkeleton } from "@/components/loading/AdminSkeletons";
import { PageHeader } from "@/components/PageHeader";

export default function Loading() {
  return (
    <div className="space-y-6 page-loading" aria-busy="true" aria-label="Loading catalog">
      <PageHeader title="Catalog" description="Products, pack offers, and stock." />
      <TableSkeleton rows={8} />
    </div>
  );
}
