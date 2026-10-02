import Link from "next/link";

import { requireRole } from "@/lib/auth/guards";
import { ORDER_STATUS_LABEL } from "@/lib/checkout/status";
import { formatPrice, formatDate } from "@/lib/format";
import { getDashboardStats } from "@/lib/queries/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  await requireRole(["ADMIN", "MANAGER"]);
  const stats = await getDashboardStats();

  const cards = [
    { label: "Revenue (paid orders)", value: formatPrice(stats.revenue) },
    { label: "Orders", value: String(stats.orderCount) },
    { label: "Customers", value: String(stats.customerCount) },
    { label: "Low-stock items", value: String(stats.lowStock.length) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live figures from the store database</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">{card.value}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Orders by status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {stats.ordersByStatus.length === 0 && (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            )}
            {stats.ordersByStatus.map((row) => (
              <span
                key={row.status}
                className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-sm"
              >
                {ORDER_STATUS_LABEL[row.status] ?? row.status}
                <span className="font-semibold tabular-nums">{row.count}</span>
              </span>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Low stock (≤ 5 on hand)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.lowStock.length === 0 && (
              <p className="text-sm text-muted-foreground">All active products are healthy.</p>
            )}
            {stats.lowStock.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 text-sm">
                <Link
                  href={`/admin/products/${product.id}`}
                  className="truncate hover:text-primary hover:underline"
                >
                  {product.name}
                </Link>
                <Badge variant={product.stock === 0 ? "destructive" : "secondary"}>
                  {product.stock} left
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium tabular-nums">
                    {order.orderNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(order.placedAt)} · {order.user.email}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums">{formatPrice(order.total)}</span>
                  <Badge variant="outline">{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top products by revenue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.topProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">No paid items yet.</p>
            )}
            {stats.topProducts.map((product) => (
              <div key={product.productId} className="flex items-center justify-between gap-3 text-sm">
                <Link
                  href={`/admin/products/${product.productId}`}
                  className="truncate hover:text-primary hover:underline"
                >
                  {product.name}
                </Link>
                <span className="shrink-0 tabular-nums">
                  {formatPrice(product.revenue)} · {product.quantity} sold
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
