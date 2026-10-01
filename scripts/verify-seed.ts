import "dotenv/config";
import { prisma } from "../lib/db";

/**
 * Verifies integrity of the NEXORA demo seed data.
 * Exits non-zero if any invariant is violated.
 */

const failures: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

async function main(): Promise<void> {
  const [categoryCount, productCount, userCount, orderCount, reviewCount, couponCount, inventoryCount] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.user.count(),
    prisma.order.count(),
    prisma.review.count(),
    prisma.coupon.count(),
    prisma.inventoryTransaction.count(),
  ]);

  check(categoryCount === 8, `expected 8 categories, got ${categoryCount}`);
  check(productCount >= 40 && productCount <= 60, `expected 40-60 products, got ${productCount}`);
  check(userCount === 5, `expected 5 demo users, got ${userCount}`);
  check(orderCount === 6, `expected 6 demo orders, got ${orderCount}`);
  check(reviewCount === 15, `expected 15 reviews, got ${reviewCount}`);
  check(couponCount === 4, `expected 4 coupons, got ${couponCount}`);
  check(inventoryCount >= 60, `expected >=60 inventory records, got ${inventoryCount}`);

  const products = await prisma.product.findMany({ include: { images: true, category: true, reviews: true } });
  for (const product of products) {
    check(product.sku.startsWith("DEMO-"), `product SKU not demo-marked: ${product.sku}`);
    check(product.images.length >= 1, `product has no images: ${product.slug}`);
    check(product.price > 0, `product price must be positive: ${product.slug}`);
    check(product.stock >= 0, `negative stock: ${product.slug}`);

    const approved = product.reviews.filter((review) => review.status === "APPROVED");
    if (approved.length > 0) {
      const avg = approved.reduce((sum, review) => sum + review.rating, 0) / approved.length;
      check(Math.abs(product.ratingAvg - avg) < 0.01, `rating mismatch on ${product.slug}: ${product.ratingAvg} vs ${avg}`);
      check(product.ratingCount === approved.length, `rating count mismatch on ${product.slug}`);
    }
  }

  const orders = await prisma.order.findMany({ include: { items: true, payment: true, user: true } });
  for (const order of orders) {
    check(order.orderNumber.startsWith("NX-DEMO-"), `order not demo-marked: ${order.orderNumber}`);
    check(order.total === order.subtotal - order.discount + order.shipping, `order total mismatch: ${order.orderNumber}`);
    for (const item of order.items) {
      check(item.lineTotal === item.unitPrice * item.quantity, `line total mismatch: ${order.orderNumber}/${item.sku}`);
      check(item.productId !== null, `order item lost product link: ${order.orderNumber}/${item.sku}`);
    }
    check(order.user.email.endsWith("@nexora.demo"), `order owner not demo user: ${order.orderNumber}`);
    if (order.payment) {
      check(order.payment.amount === order.total, `payment amount mismatch: ${order.orderNumber}`);
      check(order.payment.stripePaymentIntentId?.startsWith("pi_demo_") ?? false, `payment intent not demo-marked: ${order.orderNumber}`);
    }
  }

  const productLedgers = await prisma.inventoryTransaction.groupBy({
    by: ["productId"],
    where: { variantId: null, productId: { not: null } },
    _sum: { delta: true },
  });
  for (const ledger of productLedgers) {
    const product = products.find((candidate) => candidate.id === ledger.productId);
    if (!product) continue;
    check(product.stock === ledger._sum.delta, `stock vs ledger mismatch on ${product.slug}: ${product.stock} vs ${ledger._sum.delta}`);
  }

  const users = await prisma.user.findMany();
  for (const user of users) {
    check(user.email.endsWith("@nexora.demo"), `user not demo-marked: ${user.email}`);
  }

  const demo10 = await prisma.coupon.findUnique({ where: { code: "DEMO10" }, include: { usages: true } });
  check(demo10 !== null, "DEMO10 coupon missing");
  if (demo10) {
    check(demo10.usedCount === demo10.usages.length, `DEMO10 usedCount ${demo10.usedCount} != usages ${demo10.usages.length}`);
  }

  const expired = await prisma.coupon.findUnique({ where: { code: "WELCOME15" } });
  check(expired !== null && expired.endsAt < new Date(), "WELCOME15 should be expired");

  if (failures.length > 0) {
    console.error(`Seed verification FAILED (${failures.length} issues):`);
    for (const failure of failures) console.error(` - ${failure}`);
    process.exit(1);
  }

  console.log("Seed verification passed: all invariants hold.");
}

main()
  .catch(async (error) => {
    console.error("Verification crashed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
