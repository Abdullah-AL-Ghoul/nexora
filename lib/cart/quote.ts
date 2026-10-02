import { prisma } from "@/lib/db";
import { computeDiscount, lineTotal } from "@/lib/cart/pricing";
import type { CartItemInput } from "@/lib/validators/cart";

/**
 * Server-side cart quote: the ONLY authority on prices, stock, and line
 * totals. Client payloads are never trusted with money fields.
 */

export type QuoteLine = {
  productId: string;
  variantId: string | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  availableStock: number;
  /** qty was reduced because stock is lower than requested */
  adjusted: boolean;
  variantName: string | null;
};

export type QuoteRejection = {
  productId: string;
  variantId: string | null;
  reason: "PRODUCT_NOT_FOUND" | "OUT_OF_STOCK";
};

export type Quote = {
  lines: QuoteLine[];
  rejected: QuoteRejection[];
  subtotal: number;
};

export async function quoteCartItems(items: CartItemInput[]): Promise<Quote> {
  const productIds = [...new Set(items.map((item) => item.productId))];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      variants: { select: { id: true, name: true, priceDelta: true, stock: true } },
    },
  });

  const byId = new Map(products.map((product) => [product.id, product]));

  const lines: QuoteLine[] = [];
  const rejected: QuoteRejection[] = [];

  for (const item of items) {
    const product = byId.get(item.productId);

    if (!product || product.status !== "ACTIVE") {
      rejected.push({
        productId: item.productId,
        variantId: item.variantId ?? null,
        reason: "PRODUCT_NOT_FOUND",
      });
      continue;
    }

    const variant = item.variantId
      ? product.variants.find((entry) => entry.id === item.variantId)
      : undefined;

    if (item.variantId && !variant) {
      rejected.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "PRODUCT_NOT_FOUND",
      });
      continue;
    }

    const availableStock = variant ? variant.stock : product.stock;
    if (availableStock <= 0) {
      rejected.push({
        productId: item.productId,
        variantId: item.variantId ?? null,
        reason: "OUT_OF_STOCK",
      });
      continue;
    }

    const qty = Math.min(item.qty, availableStock);
    const unitPrice = product.price + (variant?.priceDelta ?? 0);

    lines.push({
      productId: product.id,
      variantId: item.variantId ?? null,
      name: product.name,
      slug: product.slug,
      imageUrl: product.images[0]?.url ?? null,
      unitPrice,
      qty,
      lineTotal: lineTotal(unitPrice, qty),
      availableStock,
      adjusted: qty < item.qty,
      variantName: variant?.name ?? null,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  return { lines, rejected, subtotal };
}

export type CouponCheck =
  | { ok: true; coupon: { code: string; type: "PERCENT" | "FIXED"; value: number; maxDiscountAmount: number | null } }
  | { ok: false; message: string };

/** Validates a coupon against its own record (window, activity, limits). */
export async function checkCoupon(code: string, subtotal: number): Promise<CouponCheck> {
  const coupon = await prisma.coupon.findUnique({ where: { code } });

  if (!coupon) return { ok: false, message: "Coupon not found." };
  if (!coupon.active) return { ok: false, message: "This coupon is no longer active." };

  const now = new Date();
  if (now < coupon.startsAt) return { ok: false, message: "This coupon is not active yet." };
  if (now > coupon.endsAt) return { ok: false, message: "This coupon has expired." };

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, message: "This coupon has reached its usage limit." };
  }

  if (coupon.minOrderAmount !== null && subtotal < coupon.minOrderAmount) {
    return {
      ok: false,
      message: `Minimum order of $${(coupon.minOrderAmount / 100).toFixed(2)} required for this coupon.`,
    };
  }

  const spec = {
    type: coupon.type,
    value: coupon.value,
    maxDiscountAmount: coupon.maxDiscountAmount,
  };
  if (computeDiscount(spec, subtotal) <= 0) {
    return { ok: false, message: "This coupon does not apply to your cart." };
  }

  return {
    ok: true,
    coupon: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      maxDiscountAmount: coupon.maxDiscountAmount,
    },
  };
}
