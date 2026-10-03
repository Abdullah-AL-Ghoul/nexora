import { NextResponse } from "next/server";

import { requireApiRole } from "@/lib/auth/api-guards";
import { STAFF_ROLES } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { CATALOG_TAG } from "@/lib/cache";
import { revalidateTag } from "next/cache";
import { productCreateSchema } from "@/lib/validators/admin";

/** POST /api/admin/products — create a product (Manager + Admin). */
export async function POST(request: Request) {
  const gate = await requireApiRole(STAFF_ROLES);
  if ("error" in gate) return gate.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = productCreateSchema.safeParse(body);
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
    const [slugTaken, skuTaken, categoryExists] = await Promise.all([
      prisma.product.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } }),
      prisma.product.findUnique({ where: { sku: parsed.data.sku }, select: { id: true } }),
      prisma.category.findUnique({ where: { id: parsed.data.categoryId }, select: { id: true } }),
    ]);
    if (slugTaken) {
      return NextResponse.json({ error: "That slug is already in use." }, { status: 409 });
    }
    if (skuTaken) {
      return NextResponse.json({ error: "That SKU is already in use." }, { status: 409 });
    }
    if (!categoryExists) {
      return NextResponse.json({ error: "Unknown category." }, { status: 400 });
    }

    const { imageUrl, ...data } = parsed.data;
    const product = await prisma.product.create({
      data: {
        ...data,
        images: imageUrl
          ? { create: { url: imageUrl, alt: data.name, position: 0 } }
          : undefined,
      },
      select: { id: true, slug: true },
    });

    revalidateTag(CATALOG_TAG, "max");
    return NextResponse.json({ product }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create product." }, { status: 500 });
  }
}
