"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/catalog/empty-state";
import { selectCartCount, useCartStore } from "@/lib/cart/store";
import { formatPrice } from "@/lib/format";

type QuoteLine = {
  productId: string;
  variantId: string | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  availableStock: number;
  adjusted: boolean;
  variantName: string | null;
};

type QuoteResponse = {
  lines: QuoteLine[];
  rejected: { productId: string; variantId: string | null; reason: string }[];
  subtotal: number;
};

type CouponResult = {
  coupon: { code: string; type: "PERCENT" | "FIXED"; value: number };
  subtotal: number;
  discount: number;
  total: number;
};

export function CartView() {
  const items = useCartStore((state) => state.items);
  const couponCode = useCartStore((state) => state.couponCode);
  const setCoupon = useCartStore((state) => state.setCoupon);
  const setQty = useCartStore((state) => state.setQty);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);
  const hydrated = useCartStore((state) => state._hasHydrated);

  const [quoteState, setQuoteState] = useState<{
    key: string;
    data: QuoteResponse | null;
    failed: boolean;
  } | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [applied, setApplied] = useState<CouponResult | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPending, setCouponPending] = useState(false);

  // Loading/failure are derived from a key mismatch — effects never setState
  // synchronously (react-hooks/set-state-in-effect).
  const itemsKey = JSON.stringify(items);
  const quoteKey = `${itemsKey}:${retryToken}`;
  const quote = quoteState?.key === quoteKey ? quoteState.data : null;
  const quoteFailed =
    quoteState !== null && quoteState.key === quoteKey && quoteState.failed;
  const quoteLoading = items.length > 0 && !quote && !quoteFailed;

  // Server quote: fresh prices/stock for the current items.
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    const controller = new AbortController();

    fetch("/api/cart/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      signal: controller.signal,
    })
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        if (controller.signal.aborted) return;
        setQuoteState({
          key: quoteKey,
          data: ok ? (data as QuoteResponse) : null,
          failed: !ok,
        });
        if (!ok) {
          toast.error((data as { error?: string }).error ?? "Unable to load your cart");
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQuoteState({ key: quoteKey, data: null, failed: true });
        toast.error("Unable to load your cart");
      });

    return () => controller.abort();
  }, [hydrated, items, quoteKey]);

  // Auto re-validate the applied coupon whenever the cart changes.
  useEffect(() => {
    if (!hydrated || !couponCode || !quote) return;
    if (quote.lines.length === 0) return;

    const controller = new AbortController();

    fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, items }),
      signal: controller.signal,
    })
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        if (controller.signal.aborted) return;
        if (ok) {
          setApplied(data as CouponResult);
          setCouponError(null);
        } else {
          setApplied(null);
          setCouponError((data as { error?: string }).error ?? "Coupon is no longer valid");
          setCoupon(null);
        }
      })
      .catch(() => {
        /* aborted or network error — keep last known state */
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, couponCode, quote]);

  async function applyCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    setCouponError(null);
    setCouponPending(true);
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, items }),
      });
      const data = await response.json();
      if (!response.ok) {
        setCouponError((data as { error?: string }).error ?? "Invalid coupon");
        return;
      }
      setCoupon(code); // triggers the auto revalidation effect
      setCouponInput("");
      toast.success(`Coupon ${code} applied`);
    } catch {
      setCouponError("Network error — please try again");
    } finally {
      setCouponPending(false);
    }
  }

  const itemCount = selectCartCount(items);
  // Derived (never stored) so empty/removal states never need effect writes.
  const activeApplied = items.length > 0 && couponCode && quote ? applied : null;
  const subtotal = items.length > 0 ? quote?.subtotal ?? 0 : 0;
  const discount = activeApplied?.discount ?? 0;
  const total = subtotal - discount;

  if (!hydrated) return <CartSkeleton />;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Browse the catalog and add products to see them here."
        actionLabel="Start shopping"
        actionHref="/shop"
      />
    );
  }

  if (!quote) {
    if (quoteFailed) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-6 py-14 text-center"
        >
          <p className="font-medium">We couldn&apos;t load your cart</p>
          <p className="max-w-md text-sm text-muted-foreground">
            A network or server error occurred. Your items are saved — try again.
          </p>
          <Button variant="outline" onClick={() => setRetryToken((token) => token + 1)}>
            Try again
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading your cart…
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]" aria-busy={quoteLoading}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="font-medium text-foreground tabular-nums">{itemCount}</span>{" "}
            {itemCount === 1 ? "item" : "items"} in your cart
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              clear();
              toast.success("Cart cleared");
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Clear cart
          </Button>
        </div>

        {quote.rejected.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm"
          >
            <p className="font-medium">Some items can&apos;t be purchased</p>
            <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
              {quote.rejected.map((entry) => (
                <li
                  key={`${entry.productId}-${entry.variantId ?? "base"}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span>
                    {entry.reason === "OUT_OF_STOCK"
                      ? "Out of stock — remove to continue."
                      : "No longer available — remove to continue."}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(entry.productId, entry.variantId)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {quote.lines.map((line) => (
            <li
              key={`${line.productId}-${line.variantId ?? "base"}`}
              className="flex flex-wrap items-center gap-4 p-4"
            >
              <Link
                href={`/product/${line.slug}`}
                className="relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
              >
                {line.imageUrl ? (
                  <Image
                    src={line.imageUrl}
                    alt={line.name}
                    width={80}
                    height={80}
                    className="size-20 object-cover"
                  />
                ) : null}
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${line.slug}`}
                  className="line-clamp-1 text-sm font-medium transition-colors hover:text-primary"
                >
                  {line.name}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {line.variantName ? `${line.variantName} · ` : ""}
                  {formatPrice(line.unitPrice)} each
                </p>
                {line.adjusted && (
                  <p className="mt-0.5 text-xs text-primary">
                    Limited to {line.availableStock} in stock
                  </p>
                )}
              </div>

              <div className="flex items-center rounded-md border border-border">
                <button
                  type="button"
                  aria-label={`Decrease quantity of ${line.name}`}
                  disabled={line.qty <= 1}
                  onClick={() => setQty(line.productId, line.variantId, line.qty - 1)}
                  className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm tabular-nums">{line.qty}</span>
                <button
                  type="button"
                  aria-label={`Increase quantity of ${line.name}`}
                  disabled={line.qty >= Math.min(line.availableStock, 99)}
                  onClick={() => setQty(line.productId, line.variantId, line.qty + 1)}
                  className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
                >
                  +
                </button>
              </div>

              <p className="w-20 text-right text-sm font-semibold tabular-nums">
                {formatPrice(line.lineTotal)}
              </p>

              <button
                type="button"
                aria-label={`Remove ${line.name} from cart`}
                onClick={() => removeItem(line.productId, line.variantId)}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Order summary
          </h2>

          {activeApplied ? (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-primary">
                <Tag className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate font-medium">{activeApplied.coupon.code}</span>
              </span>
              <button
                type="button"
                aria-label="Remove coupon"
                onClick={() => {
                  setCoupon(null);
                  setCouponError(null);
                }}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <form onSubmit={applyCoupon} className="mt-4 flex gap-2">
              <Input
                value={couponInput}
                onChange={(event) => setCouponInput(event.target.value)}
                placeholder="Coupon code"
                aria-label="Coupon code"
                className="h-9 uppercase"
                autoComplete="off"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="h-9"
                disabled={couponPending}
              >
                {couponPending ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
              </Button>
            </form>
          )}
          {couponError && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {couponError}
            </p>
          )}

          <dl className="mt-5 flex flex-col gap-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-primary">
                <dt>Discount</dt>
                <dd className="tabular-nums">−{formatPrice(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(total)}</dd>
            </div>
          </dl>

          <Button size="lg" className="mt-5 w-full" disabled>
            Proceed to checkout
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Taxes and shipping calculated at checkout · Free shipping over $100
          </p>
        </div>
      </aside>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-32" />
        <div className="rounded-xl border border-border bg-card">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 border-b border-border p-4 last:border-b-0">
              <Skeleton className="size-20" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>
      <aside>
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </aside>
    </div>
  );
}
