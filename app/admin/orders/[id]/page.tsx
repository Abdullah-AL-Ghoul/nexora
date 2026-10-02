import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusActions } from "@/components/admin/order-status-actions";
import { STAFF_ROLES, requireRole } from "@/lib/auth/guards";
import { PAYMENT_STATUS_LABEL, ORDER_STATUS_LABEL } from "@/lib/checkout/status";
import { formatDate, formatPrice } from "@/lib/format";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Order detail" };

function parseAddress(json: unknown): Record<string, string> | null {
  if (!json) return null;
  if (typeof json === "string") return { full: json };
  if (typeof json === "object") return json as Record<string, string>;
  return null;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(STAFF_ROLES);
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      payment: {
        select: { provider: true, status: true, stripePaymentIntentId: true, amount: true },
      },
      items: {
        select: {
          id: true,
          name: true,
          variantName: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
        },
      },
    },
  });
  if (!order) notFound();

  const address = parseAddress(order.address);
  const addressLines = address
    ? [
        address.fullName ?? address.name,
        address.line1 ?? address.street ?? address.full,
        address.line2,
        [address.city, address.postalCode ?? address.zip].filter(Boolean).join(" "),
        address.country,
        address.phone,
      ].filter((line): line is string => Boolean(line))
    : ["No address on file."];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tabular-nums">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(order.placedAt)} ·{" "}
            <Link href={`/admin/orders`} className="text-primary underline-offset-2 hover:underline">
              all orders
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge>
          <Badge variant="secondary">
            {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Move order</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusActions
            orderId={order.id}
            status={order.status}
            paymentStatus={order.paymentStatus}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4 border-b border-border pb-3 text-sm last:border-b-0 last:pb-0"
              >
                <span className="min-w-0">
                  <span className="block font-medium">
                    {item.name}
                    {item.variantName ? ` — ${item.variantName}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.quantity} × {formatPrice(item.unitPrice)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{formatPrice(item.lineTotal)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">
                Subtotal {formatPrice(order.subtotal)} · Discount {formatPrice(order.discount)} ·
                Shipping {formatPrice(order.shipping)}
              </span>
              <span className="font-semibold tabular-nums">{formatPrice(order.total)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium">{order.user.name ?? "—"}</p>
              <p className="text-muted-foreground">{order.user.email}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ship to</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 text-sm text-muted-foreground">
              {addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-muted-foreground">
                {order.payment?.provider ?? "—"} ·{" "}
                {PAYMENT_STATUS_LABEL[order.payment?.status ?? ""] ?? order.paymentStatus}
              </p>
              {order.payment?.stripePaymentIntentId && (
                <p className="break-all text-xs text-muted-foreground">
                  {order.payment.stripePaymentIntentId}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
