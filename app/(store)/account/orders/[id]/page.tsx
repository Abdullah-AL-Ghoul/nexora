import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_STATUS_LABEL, ORDER_STATUS_LABEL } from "@/lib/checkout/status";
import { requireSession } from "@/lib/auth/guards";
import { formatDate, formatPrice } from "@/lib/format";
import { getUserOrder } from "@/lib/queries/orders";

export const metadata = { title: "Order details" };

type AddressShape = {
  fullName?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  region?: string | null;
  postalCode?: string;
  country?: string;
  phone?: string | null;
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { placed } = await searchParams;

  const order = await getUserOrder(session.user.id, id);
  if (!order) notFound();

  const address = (order.address ?? {}) as AddressShape;
  const paymentLabel =
    PAYMENT_STATUS_LABEL[order.paymentStatus] ?? String(order.paymentStatus);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      {placed === "1" && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-medium">Order confirmed</p>
            <p className="text-sm text-muted-foreground">
              Thanks — a confirmation email is on its way. You can track status here.
            </p>
          </div>
        </div>
      )}

      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tabular-nums">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {formatDate(order.placedAt)}
            {order.paidAt ? ` · Paid ${formatDate(order.paidAt)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge>
          <Badge variant="secondary">{paymentLabel}</Badge>
        </div>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variantName ? `${item.variantName} · ` : ""}
                      SKU {item.sku} · Qty {item.quantity} × {formatPrice(item.unitPrice)}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums">{formatPrice(item.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-primary">
                  <dt>
                    Discount{order.couponCode ? ` · ${order.couponCode}` : ""}
                  </dt>
                  <dd className="tabular-nums">−{formatPrice(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Shipping · {ORDER_SHIPPING_LABEL[order.shippingMethod] ?? order.shippingMethod}
                </dt>
                <dd className="tabular-nums">
                  {order.shipping === 0 ? "Free" : formatPrice(order.shipping)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(order.total)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Shipping to
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium">{address.fullName ?? "—"}</p>
            <p className="text-muted-foreground">
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
            </p>
            <p className="text-muted-foreground">
              {address.city}
              {address.region ? `, ${address.region}` : ""} {address.postalCode},{" "}
              {address.country}
            </p>
            {address.phone && <p className="mt-1 text-muted-foreground">{address.phone}</p>}
            {order.notes && (
              <p className="mt-3 rounded-md bg-accent/50 p-3 text-xs text-muted-foreground">
                {order.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/account/orders">All orders</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/shop">Continue shopping</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

const ORDER_SHIPPING_LABEL: Record<string, string> = {
  standard: "Standard",
  express: "Express",
};
