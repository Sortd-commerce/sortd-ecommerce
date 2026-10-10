import { Suspense } from "react";
import Link from "next/link";
import { EditProductLink } from "@/components/EditProductLink";
import { ListToolbar } from "@/components/ListToolbar";
import { TableSkeleton } from "@/components/loading/AdminSkeletons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { apiListQuery, parseListQuery, type ListQuery } from "@/lib/list-query";
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

type CategoryOption = { id: number; name: string };

const PRODUCT_SORTS = [
  { value: "updated_at", label: "Recently updated" },
  { value: "title", label: "Title" },
  { value: "status", label: "Status" },
  { value: "category", label: "Category" },
  { value: "price", label: "Price" },
  { value: "stock", label: "Stock" },
];

async function CatalogTable({ page, query }: { page: number; query: ListQuery }) {
  const [products, categories] = await Promise.all([
    apiFetch<Paginated<ProductRow>>(`/admin/products?${apiListQuery(query, page, ADMIN_PAGE_SIZE)}`),
    apiFetch<CategoryOption[]>("/admin/categories"),
  ]);
  const data = products.data;
  const categoryOptions = (categories.data || []).map((row) => ({ value: String(row.id), label: row.name }));

  if (!products.ok) {
    return <p className="text-sm text-warn">{products.message}</p>;
  }

  return (
    <div className="panel overflow-hidden">
      <ListToolbar
        basePath="/products"
        query={query}
        fields={[
          {
            kind: "search",
            name: "search",
            label: "Search",
            placeholder: "Title, slug, or SKU",
          },
          {
            kind: "select",
            name: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
              { value: "archived", label: "Archived" },
            ],
          },
          {
            kind: "select",
            name: "category",
            label: "Category",
            options: categoryOptions,
          },
          {
            kind: "select",
            name: "sort",
            label: "Sort by",
            emptyLabel: "Recently updated",
            options: PRODUCT_SORTS,
          },
          {
            kind: "select",
            name: "order",
            label: "Order",
            emptyLabel: "Descending",
            options: [
              { value: "desc", label: "Descending" },
              { value: "asc", label: "Ascending" },
            ],
          },
        ]}
      />
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
              <td className="tabular-nums">د.إ {product.variants[0]?.price ?? "—"}</td>
              <td className="text-right">
                <EditProductLink href={`/products/${product.id}`} title={product.title} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data?.results?.length ? <p className="px-4 py-10 text-sm text-muted">No products match these filters.</p> : null}
      {data ? (
        <Pagination
          page={data.page}
          pages={data.pages}
          count={data.count}
          pageSize={data.page_size}
          basePath="/products"
          query={query}
        />
      ) : null}
    </div>
  );
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const query = parseListQuery(params);
  const page = pageFromParam(params.page);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalog"
        description="Products, pack offers, and stock."
        actions={
          <>
            <Link href="/products/categories" className="btn-ghost">
              Aisle images
            </Link>
            <Link href="/products/import" className="btn-ghost">
              Import Excel
            </Link>
            <Link href="/products/new" className="btn">
              New product
            </Link>
          </>
        }
      />
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <CatalogTable page={page} query={query} />
      </Suspense>
    </div>
  );
}
