import { prisma } from "@/lib/db";

/** Live dashboard aggregates (real DB numbers — no demo labels). */

const PAID_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export async function getDashboardStats() {
  const [revenue, orderCount, customerCount, ordersByStatus, lowStock, recentOrders, topRaw] =
    await Promise.all([
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { in: [...PAID_STATUSES] } },
      }),
      prisma.order.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.product.findMany({
        where: { status: "ACTIVE", stock: { lte: 5 } },
        orderBy: { stock: "asc" },
        take: 6,
        select: { id: true, name: true, sku: true, stock: true },
      }),
      prisma.order.findMany({
        orderBy: { placedAt: "desc" },
        take: 6,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          placedAt: true,
          user: { select: { email: true } },
        },
      }),
      prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: { lineTotal: true, quantity: true },
        where: { productId: { not: null } },
        orderBy: { _sum: { lineTotal: "desc" } },
        take: 5,
      }),
    ]);

  const topIds = topRaw.map((row) => row.productId).filter((id): id is string => id !== null);
  const topProducts = topIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(topProducts.map((product) => [product.id, product.name]));

  return {
    revenue: revenue._sum.total ?? 0,
    orderCount,
    customerCount,
    lowStock,
    recentOrders,
    ordersByStatus: ordersByStatus.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    topProducts: topRaw
      .filter((row) => row.productId !== null)
      .map((row) => ({
        productId: row.productId as string,
        name: nameById.get(row.productId as string) ?? "Deleted product",
        revenue: row._sum.lineTotal ?? 0,
        quantity: row._sum.quantity ?? 0,
      })),
  };
}
