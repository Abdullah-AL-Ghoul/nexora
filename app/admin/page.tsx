import Link from "next/link";
import {
  TrendingUp,
  ShoppingBag,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Package,
  Clock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import { requireRole } from "@/lib/auth/guards";
import { ORDER_STATUS_LABEL } from "@/lib/checkout/status";
import { formatPrice, formatDate } from "@/lib/format";
import { getDashboardStats } from "@/lib/queries/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Executive Dashboard | NEXORA" };

export default async function AdminDashboardPage() {
  await requireRole(["ADMIN", "MANAGER"]);
  const stats = await getDashboardStats();

  const totalPaidRevenue = stats.revenue;
  const avgOrderValue = stats.orderCount > 0 ? Math.round(totalPaidRevenue / stats.orderCount) : 0;

  const cards = [
    {
      label: "Gross Settled Revenue",
      value: formatPrice(totalPaidRevenue),
      subtitle: "Paid & fulfilled orders",
      icon: TrendingUp,
      badge: "+18.4% velocity",
      variant: "primary",
    },
    {
      label: "Total Volume",
      value: String(stats.orderCount),
      subtitle: `${stats.ordersByStatus.find(s => s.status === "PENDING" || s.status === "PAID")?.count ?? 0} active processing`,
      icon: ShoppingBag,
      badge: "Real-time",
      variant: "neutral",
    },
    {
      label: "VIP Clientele",
      value: String(stats.customerCount),
      subtitle: "Registered buyer accounts",
      icon: Users,
      badge: "Verified",
      variant: "neutral",
    },
    {
      label: "Inventory Attention",
      value: String(stats.lowStock.length),
      subtitle: stats.lowStock.length === 0 ? "All pieces well-stocked" : "Units ≤ 5 pieces remaining",
      icon: AlertTriangle,
      badge: stats.lowStock.length === 0 ? "Optimal" : "Restock Needed",
      variant: stats.lowStock.length > 0 ? "warning" : "neutral",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
              Command Center
            </h1>
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-xs">
              <Sparkles className="mr-1 size-3" /> Live
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time telemetry, transactions, and inventory intelligence for NEXORA Haute Horlogerie & Bijouterie.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/orders">All Orders</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/products">Manage Inventory</Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="relative overflow-hidden border-border/70 shadow-sm transition-all hover:border-border hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </CardTitle>
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {card.value}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>{card.subtitle}</span>
                  <span className="font-medium text-primary text-[11px]">{card.badge}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue & Pipeline Overview Banner */}
      <Card className="border-border/60 bg-gradient-to-r from-card via-card to-primary/[0.04]">
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Average Order Value (AOV)</p>
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{formatPrice(avgOrderValue)}</p>
              <p className="text-xs text-muted-foreground">Across settled transactions</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Status Distribution</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {stats.ordersByStatus.map((s) => (
                  <Badge key={s.status} variant="secondary" className="text-xs font-normal">
                    {ORDER_STATUS_LABEL[s.status] ?? s.status}: <span className="ml-1 font-semibold">{s.count}</span>
                  </Badge>
                ))}
                {stats.ordersByStatus.length === 0 && <span className="text-xs text-muted-foreground">Awaiting orders</span>}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fulfillment Integrity</p>
              <div className="flex items-center gap-2 pt-1 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="size-4" />
                <span>100% Guaranteed Delivery Standard</span>
              </div>
              <p className="text-xs text-muted-foreground">Insured white-glove logistics active</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout: Recent Orders & Inventory / Top Sellers */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card className="flex flex-col border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="font-serif text-lg">Recent Acquisitions</CardTitle>
              <CardDescription className="text-xs">Latest customer purchase inquiries & payments</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs gap-1">
              <Link href="/admin/orders">
                View all <ArrowUpRight className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 pt-1">
            {stats.recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ShoppingBag className="size-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-foreground">No orders recorded yet</p>
                <p className="text-xs text-muted-foreground">New customer orders will immediately display here.</p>
              </div>
            ) : (
              stats.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border/40 p-3 text-sm transition-all hover:border-primary/40 hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
                        {order.orderNumber}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {order.user.email} · {formatDate(order.placedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block font-semibold tabular-nums text-foreground">
                      {formatPrice(order.total)}
                    </span>
                    <span className="text-[11px] text-primary flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      Inspect <ArrowUpRight className="size-3" />
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Low Stock & Best Sellers */}
        <div className="space-y-6">
          {/* Low Stock Alert */}
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="font-serif text-lg">Inventory Depletion Watch</CardTitle>
                <CardDescription className="text-xs">Pieces approaching depletion (≤ 5 units)</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs gap-1">
                <Link href="/admin/products">
                  Catalog <ArrowUpRight className="size-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 pt-1">
              {stats.lowStock.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  <span>All atelier catalog pieces are safely stocked. No immediate restock required.</span>
                </div>
              ) : (
                stats.lowStock.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-2.5 text-sm"
                  >
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="min-w-0 truncate font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {product.name}
                    </Link>
                    <Badge variant={product.stock === 0 ? "destructive" : "secondary"} className="shrink-0">
                      {product.stock === 0 ? "Depleted" : `${product.stock} units left`}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Top Pieces by Demand */}
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg">Top Performing Creations</CardTitle>
              <CardDescription className="text-xs">Highest volume items by total gross sales</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-1">
              {stats.topProducts.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground">
                  <Package className="size-4 text-muted-foreground shrink-0" />
                  <span>Sales statistics will populate automatically upon completed checkouts.</span>
                </div>
              ) : (
                stats.topProducts.map((product) => (
                  <div
                    key={product.productId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-2.5 text-sm"
                  >
                    <Link
                      href={`/admin/products/${product.productId}`}
                      className="min-w-0 truncate font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {product.name}
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      <strong className="text-foreground">{formatPrice(product.revenue)}</strong> · {product.quantity} sold
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
