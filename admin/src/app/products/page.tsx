import { Suspense } from "react";
import Link from "next/link";
import { EditProductLink } from "@/components/EditProductLink";
import { TableSkeleton } from "@/components/loading/AdminSkeletons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { ADMIN_PAGE_SIZE, pageFromParam, type Paginated } from "@/lib/pagination";
import { requireAdmin } from "@/lib/staff";

type ProductRow = {
  id: number;
  title: string;
  slug: string;
  status: string;
  category: { name: string };
  variants: Array<{ on_hand: number; price: string }>;
};

async function CatalogTable({ page }: { page: number }) {
  const products = await apiFetch<Paginated<ProductRow>>(
    `/admin/products?page=${page}&page_size=${ADMIN_PAGE_SIZE}`,
  );
  const data = products.data;

  if (!products.ok) {
    return <p className="text-sm text-warn">{products.message}</p>;
  }

  return (
    <div className="panel overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Status</th>
            <th>Stock</th>
            <th>Price</th>
            <th>
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {(data?.results || []).map((product) => (
            <tr key={product.id}>
              <td>
                <Link href={`/products/${product.id}`} className="font-medium text-accent hover:underline">
                  {product.title}
                </Link>
              </td>
              <td>{product.category.name}</td>
              <td>
                <StatusBadge value={product.status} />
              </td>
              <td className="tabular-nums">{product.variants[0]?.on_hand ?? 0}</td>
              <td className="tabular-nums">AED {product.variants[0]?.price ?? "—"}</td>
              <td className="text-right">
                <EditProductLink href={`/products/${product.id}`} title={product.title} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data?.results?.length ? <p className="px-4 py-10 text-sm text-muted">No products yet.</p> : null}
      {data ? (
        <Pagination
          page={data.page}
          pages={data.pages}
          count={data.count}
          pageSize={data.page_size}
          basePath="/products"
        />
      ) : null}
    </div>
  );
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const { page: pageParam } = await searchParams;
  const page = pageFromParam(pageParam);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalog"
        description="Products, pack offers, and stock."
        actions={
          <Link href="/products/new" className="btn">
            New product
          </Link>
        }
      />
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <CatalogTable page={page} />
      </Suspense>
    </div>
  );
}
