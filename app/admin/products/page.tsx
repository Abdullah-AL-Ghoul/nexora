import Link from "next/link";

import { STAFF_ROLES, requireRole } from "@/lib/auth/guards";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPagination } from "@/components/admin/admin-pagination";
import type { Prisma, ProductStatus } from "@/lib/generated/prisma/client";

export const metadata = { title: "Products" };

const PAGE_SIZE = 20;

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireRole(STAFF_ROLES);
  const { q, status, page } = await searchParams;

  const query = (q ?? "").trim();
  const statusFilter: ProductStatus | undefined =
    status === "DRAFT" || status === "ACTIVE" || status === "ARCHIVED" ? status : undefined;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const where: Prisma.ProductWhereInput = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stock: true,
        status: true,
        category: { select: { name: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} product{totalCount === 1 ? "" : "s"}
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

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-card">
              <TableHead className="px-4 py-3 text-muted-foreground">Product</TableHead>
              <TableHead className="px-4 py-3 text-muted-foreground">Category</TableHead>
              <TableHead className="px-4 py-3 text-muted-foreground">Price</TableHead>
              <TableHead className="px-4 py-3 text-muted-foreground">Stock</TableHead>
              <TableHead className="px-4 py-3 text-muted-foreground">Status</TableHead>
              <TableHead className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No products match this filter.
                </TableCell>
              </TableRow>
            )}
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="px-4 py-3">
                  <span className="block font-medium text-foreground">{product.name}</span>
                  <span className="text-xs text-muted-foreground">{product.sku}</span>
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">{product.category.name}</TableCell>
                <TableCell className="px-4 py-3 tabular-nums text-foreground">
                  {formatPrice(product.price)}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Badge variant={product.stock <= 5 ? "destructive" : "secondary"}>
                    {product.stock}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Badge variant={statusVariant[product.status] ?? "secondary"}>
                    {product.status}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        currentPage={currentPage}
        pageCount={pageCount}
        totalItems={totalCount}
        pageSize={PAGE_SIZE}
        basePath="/admin/products"
        searchParams={{ q: query || undefined, status: statusFilter }}
      />
    </div>
  );
}
