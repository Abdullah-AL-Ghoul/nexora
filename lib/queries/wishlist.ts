import { prisma } from "@/lib/db";
import { cardInclude, type ProductCardData } from "@/lib/queries/catalog";

/** Product ids currently in a user's wishlist (empty for guests). */
export async function getWishlistProductIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
    select: { items: { select: { productId: true } } },
  });
  return wishlist?.items.map((item) => item.productId) ?? [];
}

/** Wishlist products (ACTIVE only) as catalog card data. */
export async function getWishlistItems(userId: string): Promise<ProductCardData[]> {
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
    select: {
      items: {
        orderBy: { addedAt: "desc" },
        select: { product: { include: cardInclude } },
      },
    },
  });

  return wishlist?.items
    .map((item) => item.product)
    .filter((product) => product.status === "ACTIVE") ?? [];
}
