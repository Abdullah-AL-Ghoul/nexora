"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Lock, ShieldCheck, Tag, X } from "lucide-react";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState } from "@/components/catalog/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPRESS_SHIPPING_PRICE,
  SHIPPING_METHODS,
  STANDARD_SHIPPING_PRICE,
  resolveShipping,
  type ShippingMethod,
} from "@/lib/checkout/shipping";
import { useCartStore } from "@/lib/cart/store";
import { formatPrice } from "@/lib/format";
import {
  checkoutFormSchema,
  type CheckoutFormInput,
} from "@/lib/validators/checkout";

type QuoteLine = {
  productId: string;
  variantId: string | null;
  name: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  variantName: string | null;
};

type QuoteResponse = {
  lines: QuoteLine[];
  rejected: { productId: string; reason: string }[];
  subtotal: number;
};

type CouponResult = {
  coupon: { code: string };
  subtotal: number;
  discount: number;
  total: number;
};

type ReviewState = {
  key: string;
  quote: QuoteResponse | null;
  coupon: CouponResult | null;
};

/**
 * One key per submit attempt: a double-click retries the same order instead
 * of creating a duplicate; a fresh attempt gets a fresh key.
 */
function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function CheckoutForm({ userName }: { userName: string }) {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const hydrated = useCartStore((state) => state._hasHydrated);
  const couponCode = useCartStore((state) => state.couponCode);
  const setCoupon = useCartStore((state) => state.setCoupon);
  const clear = useCartStore((state) => state.clear);

  const [review, setReview] = useState<ReviewState | null>(null);
  const [pending, setPending] = useState(false);

  const itemsKey = JSON.stringify(items);
  const reviewKey = `${itemsKey}|${couponCode ?? ""}`;

  // Review data (quote + coupon) — setState happens inside async callbacks only.
  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        if (items.length === 0) {
          setReview({ key: reviewKey, quote: null, coupon: null });
          return;
        }

        const quoteResponse = await fetch("/api/cart/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
          signal: controller.signal,
        });
        const quoteData = (await quoteResponse.json()) as QuoteResponse | { error: string };

        let couponData: CouponResult | null = null;
        if (couponCode) {
          try {
            const couponResponse = await fetch("/api/coupons/validate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: couponCode, items }),
              signal: controller.signal,
            });
            if (couponResponse.ok) {
              couponData = (await couponResponse.json()) as CouponResult;
            }
          } catch {
            /* coupon is cosmetic here — server re-validates at order creation */
          }
        }

        if (controller.signal.aborted) return;
        if (quoteResponse.ok) {
          setReview({ key: reviewKey, quote: quoteData as QuoteResponse, coupon: couponData });
        } else {
          setReview({ key: reviewKey, quote: null, coupon: null });
          toast.error((quoteData as { error?: string }).error ?? "Unable to load your cart");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setReview({ key: reviewKey, quote: null, coupon: null });
        toast.error("Unable to load your cart");
      }
    };

    void load();
    return () => controller.abort();
  }, [hydrated, items, couponCode, reviewKey]);

  const current = review !== null && review.key === reviewKey ? review : null;
  const quote = current?.quote ?? null;
  const couponResult = current?.coupon ?? null;
  const loading = hydrated && items.length > 0 && current === null;

  const form = useForm<CheckoutFormInput>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      fullName: userName,
      line1: "",
      line2: "",
      city: "",
      region: "",
      postalCode: "",
      country: "",
      phone: "",
      shippingMethod: "standard",
      notes: "",
    },
  });
  const method = useWatch({ control: form.control, name: "shippingMethod" });

  const subtotal = quote?.subtotal ?? 0;
  const discount = couponResult?.discount ?? 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const shipping = quote !== null ? resolveShipping(method, discountedSubtotal) : 0;
  const total = discountedSubtotal + shipping;

  async function onSubmit(values: CheckoutFormInput) {
    if (items.length === 0 || quote === null || pending) return;
    setPending(true);
    try {
      const { shippingMethod, notes, ...address } = values;
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          shippingMethod,
          address,
          couponCode: couponCode ?? null,
          notes: notes?.trim() ? notes : null,
          idempotencyKey: newIdempotencyKey(),
        }),
      });
      const data = (await response.json()) as {
        orderId?: string;
        url?: string | null;
        mock?: boolean;
        error?: string;
      };

      if (!response.ok || !data.orderId) {
        toast.error(data.error ?? "Unable to place your order.");
        return;
      }

      if (data.url) {
        // Absolute URL to Stripe's hosted checkout — external navigation.
        window.location.assign(data.url);
        return;
      }

      if (data.mock) {
        const payResponse = await fetch("/api/checkout/mock-pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderId }),
        });
        const payData = (await payResponse.json()) as { error?: string };
        if (!payResponse.ok) {
          toast.error(payData.error ?? "Unable to process payment.");
          return;
        }
        clear();
        router.push(`/account/orders/${data.orderId}?placed=1`);
      }
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setPending(false);
    }
  }

  if (!hydrated || loading) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (items.length === 0 || quote === null) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Add items to your cart before checking out."
        actionLabel="Browse the shop"
        actionHref="/shop"
      />
    );
  }

  if (quote.rejected.length > 0) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-6 py-14 text-center"
      >
        <p className="font-medium">Some items are no longer available</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Review your cart — the unavailable items were removed from stock.
        </p>
        <Button asChild variant="outline">
          <Link href="/cart">Back to cart</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipping address</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" autoComplete="name" {...form.register("fullName")} />
              <FieldError message={form.formState.errors.fullName?.message} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="line1">Address line 1</Label>
              <Input id="line1" autoComplete="address-line1" {...form.register("line1")} />
              <FieldError message={form.formState.errors.line1?.message} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="line2">Address line 2 (optional)</Label>
              <Input id="line2" autoComplete="address-line2" {...form.register("line2")} />
              <FieldError message={form.formState.errors.line2?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" autoComplete="address-level2" {...form.register("city")} />
              <FieldError message={form.formState.errors.city?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">State / region (optional)</Label>
              <Input id="region" autoComplete="address-level1" {...form.register("region")} />
              <FieldError message={form.formState.errors.region?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" autoComplete="postal-code" {...form.register("postalCode")} />
              <FieldError message={form.formState.errors.postalCode?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" autoComplete="country-name" {...form.register("country")} />
              <FieldError message={form.formState.errors.country?.message} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" type="tel" autoComplete="tel" {...form.register("phone")} />
              <FieldError message={form.formState.errors.phone?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery method</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(SHIPPING_METHODS) as ShippingMethod[]).map((value) => {
              const meta = SHIPPING_METHODS[value];
              const price =
                value === "express"
                  ? EXPRESS_SHIPPING_PRICE
                  : discountedSubtotal >= 10_000
                    ? 0
                    : STANDARD_SHIPPING_PRICE;
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    method === value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <input
                    type="radio"
                    value={value}
                    className="mt-1 accent-[var(--color-primary)]"
                    {...form.register("shippingMethod")}
                  />
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2 text-sm font-medium">
                      {meta.label}
                      <span className="tabular-nums">{price === 0 ? "Free" : formatPrice(price)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {meta.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order notes (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              id="notes"
              rows={3}
              placeholder="Delivery instructions, gate code…"
              {...form.register("notes")}
            />
            <FieldError message={form.formState.errors.notes?.message} />
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Placing order…
            </>
          ) : (
            <>
              Place order · {formatPrice(total)} <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          Prices are re-checked on the server before payment.
        </p>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Order review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {quote.lines.map((line) => (
                <li key={`${line.productId}:${line.variantId ?? ""}`} className="flex items-center gap-3 text-sm">
                  {line.imageUrl ? (
                    <Image
                      src={line.imageUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="size-11 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <span className="size-11 shrink-0 rounded-lg border border-border bg-muted" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{line.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {line.variantName ? `${line.variantName} · ` : ""}
                      Qty {line.qty} × {formatPrice(line.unitPrice)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatPrice(line.lineTotal)}</span>
                </li>
              ))}
            </ul>

            {couponResult ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-primary">
                  <Tag className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate font-medium">{couponResult.coupon.code}</span>
                </span>
                <button
                  type="button"
                  aria-label="Remove coupon"
                  onClick={() => setCoupon(null)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Have a code?{" "}
                <Link href="/cart" className="text-primary underline-offset-2 hover:underline">
                  Apply it in your cart
                </Link>
                .
              </p>
            )}

            <dl className="space-y-2 border-t border-border pt-4 text-sm">
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
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="tabular-nums">{shipping === 0 ? "Free" : formatPrice(shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(total)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">The NEXORA guarantee</p>
            2-year warranty on every item · 30-day no-questions returns · payment captured only
            after your order is verified fulfillable.
          </div>
        </div>
      </aside>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}
