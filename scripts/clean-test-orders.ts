import "dotenv/config";
import { prisma } from "../lib/db";

export async function cleanTestOrders(): Promise<void> {
  const testOrders = await prisma.order.findMany({
    where: { NOT: { orderNumber: { startsWith: "NX-DEMO-" } } },
    include: { items: true },
  });

  for (const order of testOrders) {
    for (const item of order.items) {
      if (item.variantId) {
        await prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        }).catch(() => undefined);
      } else if (item.productId) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        }).catch(() => undefined);
      }
    }

    if (order.couponCode) {
      await prisma.couponUsage.deleteMany({
        where: { orderId: order.id },
      }).catch(() => undefined);
      await prisma.coupon.update({
        where: { code: order.couponCode },
        data: { usedCount: { decrement: 1 } },
      }).catch(() => undefined);
    }

    await prisma.inventoryTransaction.deleteMany({
      where: { note: { contains: order.orderNumber } },
    }).catch(() => undefined);

    await prisma.order.delete({
      where: { id: order.id },
    }).catch(() => undefined);
  }

  await prisma.$disconnect();
}

if (process.argv[1]?.includes("clean-test-orders")) {
  cleanTestOrders()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Cleanup error:", err);
      process.exit(1);
    });
}
