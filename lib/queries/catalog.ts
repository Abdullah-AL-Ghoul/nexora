import { prisma } from "@/lib/db";
import { cachedCatalog } from "@/lib/cache";
import { PRODUCTS_PER_PAGE, type CatalogParams } from "@/lib/catalog/params";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Storefront data access (server-only).
 * All queries filter `status: ACTIVE` — draft/archived products never appear.
 *
 * Public, non-personalized queries are wrapped in the tag-based catalog
 * cache (lib/cache.ts); user-specific data stays per-request.
 */

export const cardInclude = {
  images: {
    orderBy: { position: "asc" },
    take: 1,
    select: { url: true, alt: true },
  },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductInclude;

export type ProductCardData = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export type CatalogResult = {
  products: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
};

function buildWhere(params: CatalogParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { status: "ACTIVE" };

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
      { brand: { contains: params.q, mode: "insensitive" } },
      { sku: { contains: params.q, mode: "insensitive" } },
    ];
  }

  if (params.category) {
    // Direct category or any of its children (depth 1 — seed is flat).
    where.category = { OR: [{ slug: params.category }, { parent: { slug: params.category } }] };
  }

  if (params.min !== undefined || params.max !== undefined) {
    where.price = {};
    if (params.min !== undefined) where.price.gte = params.min;
    if (params.max !== undefined) where.price.lte = params.max;
  }

  if (params.rating !== undefined) where.ratingAvg = { gte: params.rating };
  if (params.inStock) where.stock = { gt: 0 };

  return where;
}

const ORDER_BY: Record<
  CatalogParams["sort"],
  Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[]
> = {
  newest: { createdAt: "desc" },
  "price-asc": { price: "asc" },
  "price-desc": { price: "desc" },
  popular: { orderItems: { _count: "desc" } },
  rating: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
};

async function getCatalogProductsUncached(params: CatalogParams): Promise<CatalogResult> {
  const where = buildWhere(params);
  const skip = (params.page - 1) * PRODUCTS_PER_PAGE;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: ORDER_BY[params.sort],
      skip,
      take: PRODUCTS_PER_PAGE,
      include: cardInclude,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    total,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE)),
  };
}

export function getCatalogProducts(params: CatalogParams): Promise<CatalogResult> {
  return cachedCatalog(["catalog-products", JSON.stringify(params)], () =>
    getCatalogProductsUncached(params)
  );
}

export function getProductBySlug(slug: string) {
  return cachedCatalog(["product", slug], () => getProductBySlugUncached(slug));
}

async function getProductBySlugUncached(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      images: { orderBy: { position: "asc" }, select: { id: true, url: true, alt: true } },
      variants: { orderBy: { createdAt: "asc" } },
      category: { select: { name: true, slug: true } },
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          rating: true,
          comment: true,
          verifiedPurchase: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      },
    },
  });
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export type CategoryCard = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
  imageUrl: string | null;
};

/** All categories with ACTIVE product counts and a representative image. */
export function getCategories(): Promise<CategoryCard[]> {
  return cachedCatalog(["categories"], () => getCategoriesUncached());
}

async function getCategoriesUncached(): Promise<CategoryCard[]> {
  const categories = await prisma.category.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { products: { where: { status: "ACTIVE" } } } } },
  });

  const missingImage = categories.filter((category) => !category.imageUrl);
  const fallbackByCategory = new Map<string, string>();
  if (missingImage.length > 0) {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE", categoryId: { in: missingImage.map((category) => category.id) } },
      orderBy: { createdAt: "asc" },
      select: {
        categoryId: true,
        images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      },
    });
    for (const product of products) {
      const url = product.images[0]?.url;
      if (url && !fallbackByCategory.has(product.categoryId)) {
        fallbackByCategory.set(product.categoryId, url);
      }
    }
  }

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    productCount: category._count.products,
    imageUrl: category.imageUrl ?? fallbackByCategory.get(category.id) ?? null,
  }));
}

export function getCategoryBySlug(slug: string) {
  return cachedCatalog(["category", slug], () =>
    prisma.category.findUnique({ where: { slug } })
  );
}

/** Fill up to `take` products, ranked by rating, excluding already-selected ids. */
async function fillByRating(take: number, excludeIds: string[]): Promise<ProductCardData[]> {
  const remaining = take - excludeIds.length;
  if (remaining <= 0) return [];
  return prisma.product.findMany({
    where: { status: "ACTIVE", id: { notIn: excludeIds } },
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take: remaining,
    include: cardInclude,
  });
}

export type HomeSections = {
  featuredCategories: CategoryCard[];
  trending: ProductCardData[];
  offers: ProductCardData[];
  bestSellers: ProductCardData[];
  stats: {
    productCount: number;
    categoryCount: number;
    averageRating: number;
    reviewCount: number;
  };
};

export function getHomeSections(): Promise<HomeSections> {
  return cachedCatalog(["home-sections"], () => getHomeSectionsUncached(), 120);
}

async function getHomeSectionsUncached(): Promise<HomeSections> {
  const [categories, trendingRated, sold, productCount, reviewStats] = await Promise.all([
    getCategories(),
    prisma.product.findMany({
      where: { status: "ACTIVE", ratingCount: { gt: 0 } },
      orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
      take: 8,
      include: cardInclude,
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, product: { status: "ACTIVE" } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.review.aggregate({
      where: { status: "APPROVED" },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  // Special offer: products whose price is actually below compare-at price.
  // The real-discount filter runs in SQL (field reference); the fetch is
  // capped and the top 4 by absolute discount are picked in memory.
  const discounted = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      compareAtPrice: { gt: prisma.product.fields.price },
    },
    orderBy: [{ ratingCount: "desc" }, { createdAt: "desc" }],
    take: 24,
    include: { ...cardInclude },
  });
  const offerProducts = discounted
    .sort((a, b) => (b.compareAtPrice! - b.price) - (a.compareAtPrice! - a.price))
    .slice(0, 4);

  const soldIds = sold
    .map((row) => row.productId)
    .filter((id): id is string => id !== null);

  const bestSellerProducts = soldIds.length
    ? await prisma.product.findMany({
        where: { status: "ACTIVE", id: { in: soldIds } },
        include: cardInclude,
      }).then((products) => {
        const byId = new Map(products.map((product) => [product.id, product]));
        return soldIds
          .map((id) => byId.get(id))
          .filter((product): product is ProductCardData => product !== undefined);
      })
    : [];

  const trending = [...trendingRated];
  const trendingIds = trending.map((product) => product.id);
  if (trending.length < 8) {
    trending.push(...(await fillByRating(8, trendingIds)));
  }

  const bestSellers = [...bestSellerProducts];
  if (bestSellers.length < 8) {
    bestSellers.push(...(await fillByRating(8, bestSellers.map((product) => product.id))));
  }

  return {
    featuredCategories: categories.slice(0, 6),
    trending: trending.slice(0, 8),
    offers: offerProducts,
    bestSellers: bestSellers.slice(0, 8),
    stats: {
      productCount,
      categoryCount: categories.length,
      averageRating: reviewStats._avg.rating ?? 0,
      reviewCount: reviewStats._count,
    },
  };
}

export type ReviewStats = {
  average: number;
  count: number;
  distribution: Record<number, number>;
};

/** Rating summary + 5-bucket distribution for a product's approved reviews. */
export async function getReviewStats(productId: string): Promise<ReviewStats> {
  const [aggregate, grouped] = await Promise.all([
    prisma.review.aggregate({
      where: { productId, status: "APPROVED" },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { productId, status: "APPROVED" },
      _count: true,
    }),
  ]);

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of grouped) distribution[row.rating] = row._count;

  return {
    average: aggregate._avg.rating ?? 0,
    count: aggregate._count,
    distribution,
  };
}

/** Same-category products (fallback: top rated), excluding the current one. */
export function getRelatedProducts(
  product: { id: string; categoryId: string },
  take = 4
): Promise<ProductCardData[]> {
  return cachedCatalog(["related", product.id, String(take)], () =>
    getRelatedProductsUncached(product, take)
  );
}

async function getRelatedProductsUncached(
  product: { id: string; categoryId: string },
  take = 4
): Promise<ProductCardData[]> {
  const sameCategory = await prisma.product.findMany({
    where: { status: "ACTIVE", categoryId: product.categoryId, id: { not: product.id } },
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take,
    include: cardInclude,
  });

  if (sameCategory.length >= take) return sameCategory;

  const filler = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      id: { notIn: [product.id, ...sameCategory.map((item) => item.id)] },
    },
    orderBy: [{ ratingAvg: "desc" }, { createdAt: "desc" }],
    take: take - sameCategory.length,
    include: cardInclude,
  });

  return [...sameCategory, ...filler];
}
