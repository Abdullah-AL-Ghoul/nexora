import Link from "next/link";

import { STAFF_ROLES, requireRole } from "@/lib/auth/guards";
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
import { formatDate, formatPrice } from "@/lib/format";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ExportOrdersButton } from "@/components/admin/export-orders-button";
import type { OrderStatus } from "@/lib/generated/prisma/client";

export const metadata = { title: "Orders" };

const PAGE_SIZE = 20;

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DELIVERED: "secondary",
  SHIPPED: "outline",
  PROCESSING: "outline",
  PAID: "outline",
  PENDING: "outline",
  CANCELLED: "destructive",
  REFUNDED: "destructive",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; status?: string }>;
}) {
  await requireRole(STAFF_ROLES);
  const resolvedParams = searchParams ? await searchParams : {};
  const { page, status } = resolvedParams;

  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const validStatus = status && status in statusVariant ? (status as OrderStatus) : undefined;
  const where = validStatus ? { status: validStatus } : {};

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, email: true } }, _count: { select: { items: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} order{totalCount === 1 ? "" : "s"} — staff (Manager + Admin) section
          </p>
        </div>
        <ExportOrdersButton status={validStatus} />
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-card">
              <TableHead className="px-4 py-3 text-muted-foreground">Order</TableHead>
              <TableHead className="px-4 py-3 text-muted-foreground">Customer</TableHead>
              <TableHead className="px-4 py-3 text-muted-foreground">Items</TableHead>
              <TableHead className="px-4 py-3 text-muted-foreground">Total</TableHead>
              <TableHead className="px-4 py-3 text-muted-foreground">Status</TableHead>
              <TableHead className="px-4 py-3 text-muted-foreground">Placed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            )}
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="px-4 py-3 font-medium text-foreground">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">
                  {order.user.name ?? order.user.email}
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">{order._count.items}</TableCell>
                <TableCell className="px-4 py-3 text-foreground">{formatPrice(order.total)}</TableCell>
                <TableCell className="px-4 py-3">
                  <Badge variant={statusVariant[order.status] ?? "secondary"}>{order.status}</Badge>
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">
                  {formatDate(order.placedAt)}
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
        basePath="/admin/orders"
        searchParams={{ status: validStatus }}
      />
    </div>
  );
}
