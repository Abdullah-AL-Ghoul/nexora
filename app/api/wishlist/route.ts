import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/guards";
import { wishlistRequestSchema } from "@/lib/validators/cart";

/**
 * POST /api/wishlist — add/remove a product (authenticated users only).
 * Idempotent: adding an existing item or removing a missing one succeeds.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to use your wishlist." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = wishlistRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid wishlist payload." }, { status: 400 });
  }

  const { productId, action } = parsed.data;

  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const wishlist = await prisma.wishlist.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id },
      update: {},
      select: { id: true },
    });

    if (action === "add") {
      await prisma.wishlistItem.upsert({
        where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
        create: { wishlistId: wishlist.id, productId },
        update: {},
      });
      return NextResponse.json({ ok: true, inWishlist: true });
    }

    await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id, productId } });
    return NextResponse.json({ ok: true, inWishlist: false });
  } catch {
    return NextResponse.json({ error: "Unable to update wishlist." }, { status: 500 });
  }
}
