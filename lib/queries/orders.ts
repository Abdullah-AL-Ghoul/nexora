import { prisma } from "@/lib/db";

/** Order history queries (ownership is always part of the where clause). */

export async function listUserOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { placedAt: "desc" },
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
  });
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
