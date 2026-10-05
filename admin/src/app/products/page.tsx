import Link from "next/link";
import { EditProductLink } from "@/components/EditProductLink";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { requireAdmin } from "@/lib/staff";

type Products = {
  results: Array<{
    id: number;
    title: string;
    slug: string;
    status: string;
    category: { name: string };
    variants: Array<{ on_hand: number; price: string }>;
  }>;
};

export default async function AdminProductsPage() {
  await requireAdmin();
  const products = await apiFetch<Products>("/admin/products?page_size=100");

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
            {(products.data?.results || []).map((product) => (
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
        {!products.data?.results?.length ? <p className="px-4 py-10 text-sm text-muted">No products yet.</p> : null}
      </div>
    </div>
  );
}
