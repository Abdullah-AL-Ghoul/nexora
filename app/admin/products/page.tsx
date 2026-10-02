import Link from "next/link";

import { STAFF_ROLES, requireRole } from "@/lib/auth/guards";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Products" };

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireRole(STAFF_ROLES);
  const { q, status } = await searchParams;

  const query = (q ?? "").trim();
  const statusFilter =
    status === "DRAFT" || status === "ACTIVE" || status === "ARCHIVED" ? status : undefined;

  const products = await prisma.product.findMany({
    where: {
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      stock: true,
      status: true,
      category: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} product{products.length === 1 ? "" : "s"}
            {query ? ` matching “${query}”` : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">New product</Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-2" action="/admin/products" method="GET">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search name or SKU…"
          aria-label="Search products"
          className="h-9 w-64"
        />
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          aria-label="Filter by status"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <Button type="submit" variant="secondary" size="sm" className="h-9">
          Filter
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No products match this filter.
                </td>
              </tr>
            )}
            {products.map((product) => (
              <tr key={product.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3">
                  <span className="block font-medium text-foreground">{product.name}</span>
                  <span className="text-xs text-muted-foreground">{product.sku}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{product.category.name}</td>
                <td className="px-4 py-3 tabular-nums text-foreground">
                  {formatPrice(product.price)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={product.stock <= 5 ? "destructive" : "secondary"}>
                    {product.stock}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant[product.status] ?? "secondary"}>
                    {product.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
