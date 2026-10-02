import { STAFF_ROLES, requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

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

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Placed</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 font-medium text-foreground">{order.orderNumber}</td>
                <td className="px-4 py-3 text-muted-foreground">{order.user.name ?? order.user.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{order._count.items}</td>
                <td className="px-4 py-3 text-foreground">${(order.total / 100).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant[order.status] ?? "secondary"}>{order.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{order.placedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
