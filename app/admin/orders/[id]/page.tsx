import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusActions } from "@/components/admin/order-status-actions";
import { OrderPrintButton } from "@/components/admin/order-print-button";
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
        <div className="flex flex-wrap items-center gap-2">
          <OrderPrintButton orderNumber={order.orderNumber} />
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

      {/* Printable Luxury Packing Slip & Certificate of Authenticity (Visible ONLY on print) */}
      <div className="hidden print:block border-t-2 border-primary/40 pt-8 mt-12 space-y-6 text-black">
        <div className="flex justify-between items-start border-b pb-4">
          <div>
            <h2 className="font-serif text-3xl font-bold tracking-widest uppercase">NEXORA</h2>
            <p className="text-xs uppercase tracking-wider text-gray-500 mt-1">Haute Horlogerie & Joaillerie Atelier</p>
          </div>
          <div className="text-right">
            <p className="font-serif text-sm font-semibold">Official Dispatch Record</p>
            <p className="text-xs text-gray-600">Ref: {order.orderNumber}</p>
            <p className="text-xs text-gray-600">Date: {formatDate(order.placedAt)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold uppercase tracking-wider text-gray-500 mb-1">Delivered To:</p>
            <p className="font-medium text-sm">{order.user.name ?? "Valued Collector"}</p>
            <p className="text-gray-600">{order.user.email}</p>
            {addressLines.map((line) => (
              <p key={line} className="text-gray-600">{line}</p>
            ))}
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wider text-gray-500 mb-1">Security & Authenticity:</p>
            <p className="text-gray-700">✓ 2-Year International Atelier Guarantee</p>
            <p className="text-gray-700">✓ Certified Insured Transit</p>
            <p className="text-gray-700">✓ Serial Registration Active</p>
            <p className="text-gray-700 mt-1">Settlement Status: <strong className="uppercase">{order.paymentStatus}</strong></p>
          </div>
        </div>

        <div className="border-t pt-4">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b text-gray-500 uppercase tracking-wider">
                <th className="py-2">Curated Item</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Valuation</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 font-medium">{item.name}{item.variantName ? ` (${item.variantName})` : ""}</td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">{formatPrice(item.unitPrice)}</td>
                  <td className="py-2 text-right font-medium">{formatPrice(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center border-t-2 border-primary/20 pt-4 text-xs">
          <p className="italic text-gray-500">Each NEXORA creation is verified for gemstone purity and caliber precision.</p>
          <p className="font-serif text-base font-bold">Total Settled: {formatPrice(order.total)}</p>
        </div>
      </div>
    </div>
  );
}
