import { NextResponse } from "next/server";

import { requireApiRole } from "@/lib/auth/api-guards";
import { STAFF_ROLES } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { inventoryAdjustSchema } from "@/lib/validators/admin";

/**
 * POST /api/admin/inventory — explicit stock adjustment (Manager + Admin).
 * Writes an InventoryTransaction with the acting staff user; the resulting
 * stock can never go negative.
 */
export async function POST(request: Request) {
  const gate = await requireApiRole(STAFF_ROLES);
  if ("error" in gate) return gate.error;
  const actorId = gate.session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = inventoryAdjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid inventory payload.", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const { productId, delta, reason, note } = parsed.data;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, stock: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const balanceAfter = product.stock + delta;
    if (balanceAfter < 0) {
      return NextResponse.json(
        { error: `Insufficient stock: only ${product.stock} on hand.` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: balanceAfter },
        select: { id: true, stock: true },
      });
      await tx.inventoryTransaction.create({
        data: {
          productId,
          delta,
          reason,
          balanceAfter: updated.stock,
          note: note ?? null,
          actorId,
        },
      });
      return updated;
    });

    return NextResponse.json({ product: result });
  } catch {
    return NextResponse.json({ error: "Unable to adjust inventory." }, { status: 500 });
  }
}
