import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cardInclude } from "@/lib/queries/catalog";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = clientIp(request);
  const limiter = rateLimit(`search:${ip}`, 60, 60_000);
  if (!limiter.ok) {
    return rateLimitResponse(limiter.retryAfterSeconds);
  }

  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get("q")?.trim() || "";
  // Sanitize and cap query string length (max 100 chars)
  const q = rawQ.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").slice(0, 100).trim();

  const cacheHeaders = {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
  };

  try {
    if (!q) {
      // Suggest top trending products
      const products = await prisma.product.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
        take: 5,
        include: cardInclude,
      });
      return NextResponse.json({ products }, { headers: cacheHeaders });
    }

    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { category: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 6,
      include: cardInclude,
    });

    return NextResponse.json({ products }, { headers: cacheHeaders });
  } catch {
    return NextResponse.json({ products: [] }, { status: 500 });
  }
}
