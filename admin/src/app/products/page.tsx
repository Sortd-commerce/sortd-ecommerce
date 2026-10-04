import Link from "next/link";
import { redirect } from "next/navigation";
import { EditProductLink } from "@/components/EditProductLink";
import { apiFetch } from "@/lib/api";

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
  const products = await apiFetch<Products>("/admin/products?page_size=100");
  if (products.status === 401 || products.status === 403) redirect("/login");

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-pretty text-3xl font-semibold">Products</h1>
        <Link href="/products/new" className="btn">
          New product
        </Link>
      </div>
      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel-2 text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(products.data?.results || []).map((product) => (
              <tr key={product.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link href={`/products/${product.id}`} className="text-accent hover:underline">
                    {product.title}
                  </Link>
                </td>
                <td className="px-4 py-3">{product.category.name}</td>
                <td className="px-4 py-3">{product.status}</td>
                <td className="px-4 py-3 tabular-nums">{product.variants[0]?.on_hand ?? 0}</td>
                <td className="px-4 py-3 tabular-nums">AED {product.variants[0]?.price ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <EditProductLink href={`/products/${product.id}`} title={product.title} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
