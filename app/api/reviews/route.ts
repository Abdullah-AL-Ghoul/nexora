import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/guards";
import { CATALOG_TAG } from "@/lib/cache";

import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const reviewSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(3, "Comment must be at least 3 characters").max(1000),
});

export async function POST(request: Request) {
  const limit = rateLimit(`reviews:${clientIp(request)}`, 10, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSeconds);

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in to write a review" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid review data" }, { status: 400 });
    }

    const { productId, rating, comment } = parsed.data;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check if user has an order for this product (verified purchase)
    const orderWithProduct = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId: session.user.id,
          paymentStatus: "SUCCEEDED",
        },
      },
      select: { id: true },
    });

    const isVerified = Boolean(orderWithProduct);

    // Upsert review (one per user per product)
    const review = await prisma.review.upsert({
      where: {
        productId_userId: {
          productId,
          userId: session.user.id,
        },
      },
      create: {
        productId,
        userId: session.user.id,
        rating,
        comment,
        status: "APPROVED",
        verifiedPurchase: isVerified,
      },
      update: {
        rating,
        comment,
        status: "APPROVED",
        verifiedPurchase: isVerified,
        updatedAt: new Date(),
      },
      include: {
        user: { select: { name: true } },
      },
    });

    // Recompute product ratings
    const agg = await prisma.review.groupBy({
      by: ["productId"],
      where: { productId, status: "APPROVED" },
      _avg: { rating: true },
      _count: true,
    });

    const group = agg[0];
    if (group) {
      await prisma.product.update({
        where: { id: productId },
        data: {
          ratingAvg: group._avg.rating ?? 0,
          ratingCount: group._count,
        },
      });
    }

    revalidateTag(CATALOG_TAG, "max");

    return NextResponse.json({
      ok: true,
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        verifiedPurchase: review.verifiedPurchase,
        createdAt: review.createdAt.toISOString(),
        user: { name: review.user.name },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit review";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
