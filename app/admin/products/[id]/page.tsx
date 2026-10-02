import { notFound } from "next/navigation";

import { InventoryAdjust } from "@/components/admin/inventory-adjust";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";
import { STAFF_ROLES, requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(STAFF_ROLES);
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { images: { orderBy: { position: "asc" }, take: 1 } },
    }),
    prisma.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!product) notFound();

  const initial: ProductFormValues = {
    name: product.name,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    stock: product.stock,
    brand: product.brand,
    status: product.status,
    categoryId: product.categoryId,
    imageUrl: product.images[0]?.url ?? null,
    slug: product.slug,
    sku: product.sku,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Edit product</h1>
        <p className="text-sm text-muted-foreground">
          {product.sku} · created {product.createdAt.toISOString().slice(0, 10)}
        </p>
      </div>
      <InventoryAdjust productId={product.id} stock={product.stock} />
      <ProductForm mode="edit" productId={product.id} categories={categories} initial={initial} />
    </div>
  );
}
