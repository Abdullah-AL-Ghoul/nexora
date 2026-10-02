import { notFound } from "next/navigation";

import { ProductForm } from "@/components/admin/product-form";
import { STAFF_ROLES, requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireRole(STAFF_ROLES);
  const categories = await prisma.category.findMany({
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });
  if (categories.length === 0) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New product</h1>
        <p className="text-sm text-muted-foreground">New products start as drafts.</p>
      </div>
      <ProductForm mode="create" categories={categories} />
    </div>
  );
}
