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

export const metadata = { title: "Orders" };

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DELIVERED: "secondary",
  SHIPPED: "outline",
  PROCESSING: "outline",
  PAID: "outline",
  PENDING: "outline",
  CANCELLED: "destructive",
  REFUNDED: "destructive",
};

export default async function AdminOrdersPage() {
  await requireRole(STAFF_ROLES);

  const orders = await prisma.order.findMany({
    orderBy: { placedAt: "desc" },
    take: 25,
    include: { user: { select: { name: true, email: true } }, _count: { select: { items: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
        <p className="text-sm text-muted-foreground">Latest 25 orders — staff (Manager + Admin) section</p>
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
    </div>
  );
}
