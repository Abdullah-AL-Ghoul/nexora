import { NextResponse } from "next/server";
import { requireRole, STAFF_ROLES } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import type { OrderStatus } from "@/lib/generated/prisma/client";

export async function GET(request: Request) {
  try {
    await requireRole(STAFF_ROLES);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const status = statusParam ? (statusParam as OrderStatus) : undefined;

    const where = status ? { status } : {};
    const orders = await prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
    });

    const header = [
      "Order Number",
      "Date Placed",
      "Customer Name",
      "Customer Email",
      "Status",
      "Payment Status",
      "Item Count",
      "Subtotal ($)",
      "Discount ($)",
      "Shipping ($)",
      "Total ($)",
      "Shipping Method",
      "Coupon Code",
    ];

    const escapeCsv = (val: string) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const rows = orders.map((o) => [
      o.orderNumber,
      o.placedAt.toISOString(),
      o.user.name ?? "",
      o.user.email,
      o.status,
      o.paymentStatus,
      o._count.items.toString(),
      (o.subtotal / 100).toFixed(2),
      (o.discount / 100).toFixed(2),
      (o.shipping / 100).toFixed(2),
      (o.total / 100).toFixed(2),
      o.shippingMethod,
      o.couponCode ?? "",
    ]);

    const csvContent = [
      header.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\r\n");

    const filename = `nexora-orders-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized or failed to export";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
