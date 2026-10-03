import type { MetadataRoute } from "next";

import { getPublicEnv } from "@/lib/env";
import { getCategories } from "@/lib/queries/catalog";
import { prisma } from "@/lib/db";

/**
 * Dynamic sitemap: static storefront routes + every ACTIVE product and
 * category. Admin, account, and API surfaces are intentionally excluded.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;

  const staticRoutes = ["", "/shop", "/categories", "/login", "/register"].map(
    (path) => ({
      url: `${appUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })
  );

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    getCategories(),
  ]);

  const productRoutes = products.map((product) => ({
    url: `${appUrl}/product/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const categoryRoutes = categories.map((category) => ({
    url: `${appUrl}/category/${category.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes, ...categoryRoutes];
}
