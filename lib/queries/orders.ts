import { prisma } from "@/lib/db";

/** Order history queries (ownership is always part of the where clause). */

export const ORDERS_PER_PAGE = 10;

export async function listUserOrders(userId: string, page: number = 1) {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { placedAt: "desc" },
      take: ORDERS_PER_PAGE,
      skip: (page - 1) * ORDERS_PER_PAGE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        placedAt: true,
        items: { select: { name: true, quantity: true }, take: 3 },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  return { orders, total, pageCount: Math.max(1, Math.ceil(total / ORDERS_PER_PAGE)) };
}

export async function getUserOrder(userId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      subtotal: true,
      discount: true,
      shipping: true,
      total: true,
      shippingMethod: true,
      address: true,
      couponCode: true,
      notes: true,
      placedAt: true,
      paidAt: true,
      items: {
        select: {
          id: true,
          name: true,
          sku: true,
          variantName: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
        },
      },
      payment: { select: { status: true, provider: true } },
    },
  });
}
