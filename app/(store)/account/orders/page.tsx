import Link from "next/link";

import { EmptyState } from "@/components/catalog/empty-state";
import { Pager } from "@/components/pager";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth/guards";
import { formatPrice, formatDate } from "@/lib/format";
import { listUserOrders } from "@/lib/queries/orders";
import { ORDER_STATUS_LABEL } from "@/lib/checkout/status";

export const metadata = { title: "Orders" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { orders, total, pageCount } = await listUserOrders(session.user.id, page);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your order history and current statuses.
        </p>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="When you place an order it will show up here with live status updates."
          actionLabel="Start shopping"
          actionHref="/shop"
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            {total} order{total === 1 ? "" : "s"}
          </p>
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium tabular-nums">{order.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(order.placedAt)} · {order._count.items} item
                      {order._count.items === 1 ? "" : "s"}
                      {order.items[0] ? ` · ${order.items[0].name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="font-medium tabular-nums">{formatPrice(order.total)}</span>
                    <Badge variant={order.status === "PAID" ? "default" : "secondary"}>
                      {ORDER_STATUS_LABEL[order.status] ?? order.status}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Pager
              page={page}
              pageCount={pageCount}
              label="Order history pagination"
              hrefFor={(target) => `/account/orders?page=${target}`}
            />
          </div>
        </>
      )}
    </div>
  );
}
