"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { selectCartCount, useCartStore } from "@/lib/cart/store";
import { formatPrice } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/checkout/shipping";

const FREE_SHIPPING_THRESHOLD_CENTS = FREE_SHIPPING_THRESHOLD;

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

export function CartDrawer() {
  const items = useCartStore((state) => state.items);
  const hydrated = useCartStore((state) => state._hasHydrated);
  const isDrawerOpen = useCartStore((state) => state.isDrawerOpen);
  const closeDrawer = useCartStore((state) => state.closeDrawer);
  const setQty = useCartStore((state) => state.setQty);
  const removeItem = useCartStore((state) => state.removeItem);

  const [quoteState, setQuoteState] = useState<{
    key: string;
    data: QuoteResponse | null;
    failed: boolean;
  } | null>(null);

  const itemsKey = JSON.stringify(items);
  const quote = quoteState?.key === itemsKey ? quoteState.data : null;
  const quoteFailed = quoteState !== null && quoteState.key === itemsKey && quoteState.failed;
  const quoteLoading = items.length > 0 && !quote && !quoteFailed;
  const itemCount = hydrated ? selectCartCount(items) : 0;

  useEffect(() => {
    if (!hydrated || items.length === 0 || !isDrawerOpen) return;
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
          key: itemsKey,
          data: ok ? (data as QuoteResponse) : null,
          failed: !ok,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQuoteState({ key: itemsKey, data: null, failed: true });
      });

    return () => controller.abort();
  }, [hydrated, items, itemsKey, isDrawerOpen]);

  const subtotal = quote?.subtotal ?? 0;
  const freeShippingProgress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD_CENTS) * 100));
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - subtotal);

  return (
    <Sheet open={isDrawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md border-l border-border bg-card"
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="size-5 text-primary" aria-hidden="true" />
              <SheetTitle className="text-lg font-semibold tracking-tight">Your Cart</SheetTitle>
              {itemCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
                  {itemCount}
                </span>
              )}
            </div>
          </div>
          <SheetDescription className="sr-only">
            Interactive shopping cart drawer with live subtotal and free shipping calculation.
          </SheetDescription>

          {/* Free Shipping Progress Meter */}
          {itemCount > 0 && (
            <div className="mt-3 rounded-lg border border-border/60 bg-muted/50 p-3">
              <div className="flex items-center justify-between text-xs">
                {subtotal >= FREE_SHIPPING_THRESHOLD_CENTS ? (
                  <span className="font-medium text-primary">✨ Complimentary White-Glove Courier Unlocked!</span>
                ) : (
                  <span>
                    Add <strong className="text-primary">{formatPrice(remainingForFreeShipping)}</strong> more for complimentary courier
                  </span>
                )}
                <span className="font-mono text-[11px] text-muted-foreground">{freeShippingProgress}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500 ease-out"
                  style={{ width: `${freeShippingProgress}%` }}
                />
              </div>
            </div>
          )}
        </SheetHeader>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {itemCount === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-12">
              <div className="rounded-full bg-muted p-4 text-muted-foreground/50 mb-4">
                <ShoppingBag className="size-10" aria-hidden="true" />
              </div>
              <h3 className="text-base font-medium">Your cart is empty</h3>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Discover our curated precision electronics and luxury essentials.
              </p>
              <Button asChild className="mt-6" onClick={closeDrawer}>
                <Link href="/shop">Start Shopping</Link>
              </Button>
            </div>
          ) : quoteLoading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              Calculating fresh prices…
            </div>
          ) : quote?.lines && quote.lines.length > 0 ? (
            <ul className="divide-y divide-border/60" role="list">
              {quote.lines.map((line) => (
                <li
                  key={`${line.productId}:${line.variantId ?? "default"}`}
                  className="flex gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {line.imageUrl ? (
                      <Image
                        src={line.imageUrl}
                        alt={line.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground/40 text-xs">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/product/${line.slug}`}
                          onClick={closeDrawer}
                          className="line-clamp-1 text-sm font-medium hover:text-primary transition-colors"
                        >
                          {line.name}
                        </Link>
                        {line.variantName && (
                          <p className="text-xs text-muted-foreground">{line.variantName}</p>
                        )}
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          {formatPrice(line.unitPrice)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          removeItem(line.productId, line.variantId);
                          toast.success("Item removed from cart");
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        aria-label={`Remove ${line.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded border border-border bg-muted/40">
                        <button
                          type="button"
                          onClick={() => setQty(line.productId, line.variantId, line.qty - 1)}
                          className="flex size-7 items-center justify-center text-muted-foreground hover:text-primary"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-mono font-medium">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          disabled={line.qty >= line.availableStock}
                          onClick={() => setQty(line.productId, line.variantId, line.qty + 1)}
                          className="flex size-7 items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold font-mono text-foreground">
                        {formatPrice(line.lineTotal)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Unable to refresh items. Please view the full cart page.
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {itemCount > 0 && (
          <div className="border-t border-border bg-muted/20 p-6 space-y-4">
            <div className="flex items-center justify-between text-base">
              <span className="font-medium text-foreground">Subtotal</span>
              <span className="font-mono font-semibold text-lg text-primary">
                {formatPrice(subtotal)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <Button asChild size="lg" className="w-full gap-2" onClick={closeDrawer}>
                <Link href="/checkout">
                  Proceed to Checkout
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full" onClick={closeDrawer}>
                <Link href="/cart">View Cart ({itemCount})</Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
