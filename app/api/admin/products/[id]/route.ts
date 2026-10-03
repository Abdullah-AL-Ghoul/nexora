import { NextResponse } from "next/server";

import { requireApiRole } from "@/lib/auth/api-guards";
import { STAFF_ROLES } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { CATALOG_TAG } from "@/lib/cache";
import { revalidateTag } from "next/cache";
import { productPatchSchema } from "@/lib/validators/admin";

/**
 * PATCH /api/admin/products/[id] — edit product fields (Manager + Admin).
 * A stock change is recorded as an ADJUSTMENT inventory transaction
 * (actor = staff user), never as a silent overwrite.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireApiRole(STAFF_ROLES);
  if ("error" in gate) return gate.error;
  const actorId = gate.session.user.id;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = productPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid product payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true, stock: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const categoryExists = await prisma.category.findUnique({
      where: { id: parsed.data.categoryId },
      select: { id: true },
    });
    if (!categoryExists) {
      return NextResponse.json({ error: "Unknown category." }, { status: 400 });
    }

    const { imageUrl, ...fields } = parsed.data;
    const stockDelta = fields.stock - existing.stock;

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...fields,
          images: imageUrl
            ? { deleteMany: {}, create: { url: imageUrl, alt: fields.name, position: 0 } }
            : undefined,
        },
        select: { id: true, stock: true, status: true, price: true },
      });

      if (stockDelta !== 0) {
        await tx.inventoryTransaction.create({
          data: {
            productId: id,
            delta: stockDelta,
            reason: "ADJUSTMENT",
            balanceAfter: updated.stock,
            note: "Stock edited from product form",
            actorId,
          },
        });
      }

      return updated;
    });

    revalidateTag(CATALOG_TAG, "max");
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "Unable to update product." }, { status: 500 });
  }
}
