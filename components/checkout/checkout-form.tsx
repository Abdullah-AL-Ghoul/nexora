"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Info,
  Loader2,
  Lock,
  Package,
  ShieldCheck,
  Sparkles,
  Tag,
  Truck,
  X,
} from "lucide-react";
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
  coupon: { code: string; type: string; value: number };
  subtotal: number;
  discount: number;
  total: number;
};

type ReviewState = {
  key: string;
  quote: QuoteResponse | null;
  coupon: CouponResult | null;
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export type SavedAddressProp = {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
};

const NOTE_CHIPS = [
  "🛎️ Leave with building concierge",
  "📞 Call 15 mins before arrival",
  "🚪 Ring doorbell upon arrival",
  "🌅 Evening courier delivery preferred",
];

export function CheckoutForm({
  userName,
  savedAddress,
}: {
  userName: string;
  savedAddress?: SavedAddressProp | null;
}) {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const hydrated = useCartStore((state) => state._hasHydrated);
  const couponCode = useCartStore((state) => state.couponCode);
  const setCoupon = useCartStore((state) => state.setCoupon);
  const clear = useCartStore((state) => state.clear);

  const [review, setReview] = useState<ReviewState | null>(null);
  const [pending, setPending] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponPending, setCouponPending] = useState(false);
  const [addressMode, setAddressMode] = useState<"saved" | "custom">(
    savedAddress ? "saved" : "custom"
  );

  const itemsKey = JSON.stringify(items);
  const reviewKey = `${itemsKey}|${couponCode ?? ""}`;

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
            } else {
              setCoupon(null);
            }
          } catch {
            // Non-blocking
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
  }, [hydrated, items, couponCode, reviewKey, setCoupon]);

  const current = review !== null && review.key === reviewKey ? review : null;
  const quote = current?.quote ?? null;
  const couponResult = current?.coupon ?? null;
  const loading = hydrated && items.length > 0 && current === null;

  const form = useForm<CheckoutFormInput>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      fullName: savedAddress?.fullName || userName,
      line1: savedAddress?.line1 || "",
      line2: savedAddress?.line2 || "",
      city: savedAddress?.city || "",
      region: savedAddress?.region || "",
      postalCode: savedAddress?.postalCode || "",
      country: savedAddress?.country || "United States",
      phone: savedAddress?.phone || "",
      shippingMethod: "standard",
      paymentMethod: "card",
      notes: "",
    },
  });

  const method = useWatch({ control: form.control, name: "shippingMethod" });
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" });
  const notesValue = useWatch({ control: form.control, name: "notes" });

  const subtotal = quote?.subtotal ?? 0;
  const discount = couponResult?.discount ?? 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const shipping = quote !== null ? resolveShipping(method, discountedSubtotal) : 0;
  const total = discountedSubtotal + shipping;

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply ?? couponInput).trim().toUpperCase();
    if (!code) {
      toast.error("Please enter a privilege promo code.");
      return;
    }
    setCouponPending(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, items }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Privilege code is invalid or expired.");
      } else {
        setCoupon(code);
        setCouponInput("");
        toast.success(`Privilege code ${code} verified & applied!`);
      }
    } catch {
      toast.error("Network error while validating code.");
    } finally {
      setCouponPending(false);
    }
  };

  const handleAddNoteChip = (chip: string) => {
    const currentNotes = form.getValues("notes") || "";
    if (currentNotes.includes(chip)) return;
    const updated = currentNotes.trim() ? `${currentNotes.trim()} · ${chip}` : chip;
    form.setValue("notes", updated, { shouldDirty: true });
  };

  async function onSubmit(values: CheckoutFormInput) {
    if (items.length === 0 || quote === null || pending) return;
    setPending(true);
    try {
      const { shippingMethod, paymentMethod, notes, ...address } = values;

      // If in saved address mode, enforce saved address values
      const addressPayload =
        addressMode === "saved" && savedAddress
          ? {
              fullName: savedAddress.fullName,
              line1: savedAddress.line1,
              line2: savedAddress.line2 ?? null,
              city: savedAddress.city,
              region: savedAddress.region ?? null,
              postalCode: savedAddress.postalCode,
              country: savedAddress.country,
              phone: savedAddress.phone ?? null,
            }
          : address;

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          shippingMethod,
          paymentMethod,
          address: addressPayload,
          couponCode: couponCode ?? null,
          notes: notes?.trim() ? notes : null,
          idempotencyKey: newIdempotencyKey(),
        }),
      });

      const data = (await response.json()) as {
        orderId?: string;
        orderNumber?: string;
        url?: string | null;
        cod?: boolean;
        error?: string;
      };

      if (!response.ok || !data.orderId) {
        toast.error(data.error ?? "Unable to finalize order.");
        return;
      }

      if (data.cod) {
        clear();
        toast.success(`Order ${data.orderNumber ?? ""} confirmed with White-Glove Courier!`);
        router.push(`/account/orders/${data.orderId}?placed=1`);
        return;
      }

      if (data.url) {
        // Redirect directly to Stripe's encrypted payment checkout page
        window.location.assign(data.url);
        return;
      }

      toast.error("Payment session could not be established. Please try again.");
    } catch {
      toast.error("Network error — please verify your connection.");
    } finally {
      setPending(false);
    }
  }

  if (!hydrated || loading) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_390px]">
        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (items.length === 0 || quote === null) {
    return (
      <EmptyState
        title="Your bag is currently empty"
        description="Select exclusive pieces from our collection before proceeding to checkout."
        actionLabel="Explore Atelier Shop"
        actionHref="/shop"
      />
    );
  }

  if (quote.rejected.length > 0) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Package className="size-6" />
        </div>
        <div>
          <p className="font-serif text-lg font-semibold text-foreground">Items No Longer Available</p>
          <p className="max-w-md text-sm text-muted-foreground mt-1">
            Some selected items were claimed by another patron. Please review your bag to continue.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/cart">Return to Bag</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_390px]">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Step 1: Shipping Address & Patron Profile */}
        <Card className="rounded-2xl border border-border/80 shadow-soft overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground font-mono">
                  1
                </span>
                <CardTitle className="font-serif text-base font-medium">
                  Delivery Destination & Contact
                </CardTitle>
              </div>
              {savedAddress && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="size-3" />
                  1-Click Ready
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-5">
            {savedAddress ? (
              <div className="space-y-4">
                {/* Saved Address Selection Toggle */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAddressMode("saved")}
                    className={`flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all ${
                      addressMode === "saved"
                        ? "border-primary bg-primary/[0.04] ring-1 ring-primary shadow-sm"
                        : "border-border/80 hover:border-primary/40 bg-card"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5" /> Saved Atelier Address
                      </span>
                      <span className="text-[11px] text-muted-foreground">Default</span>
                    </div>
                    <p className="font-medium text-sm text-foreground mt-1">{savedAddress.fullName}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {savedAddress.line1}
                      {savedAddress.line2 ? `, ${savedAddress.line2}` : ""}
                      <br />
                      {savedAddress.city}, {savedAddress.postalCode} · {savedAddress.country}
                    </p>
                    {savedAddress.phone && (
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                        Tel: {savedAddress.phone}
                      </p>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddressMode("custom")}
                    className={`flex flex-col items-start justify-center gap-1.5 rounded-xl border p-4 text-left transition-all ${
                      addressMode === "custom"
                        ? "border-primary bg-primary/[0.04] ring-1 ring-primary shadow-sm"
                        : "border-border/80 hover:border-primary/40 bg-card"
                    }`}
                  >
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      Deliver to a Different Address
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                      Enter an alternative villa, office, hotel suite, or international residence.
                    </p>
                  </button>
                </div>

                {addressMode === "saved" && (
                  <p className="text-xs text-muted-foreground flex items-center justify-between px-1">
                    <span>Your package will be delivered directly to this primary address.</span>
                    <Link
                      href="/account"
                      className="text-primary hover:underline font-medium text-[11px]"
                    >
                      Edit in Profile →
                    </Link>
                  </p>
                )}
              </div>
            ) : null}

            {/* Custom / Manual Form Fields */}
            {(addressMode === "custom" || !savedAddress) && (
              <div className="grid gap-4 sm:grid-cols-2 pt-1 border-t border-border/50">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="fullName" className="text-xs font-medium">Full Name *</Label>
                  <Input id="fullName" autoComplete="name" {...form.register("fullName")} placeholder="Lord / Lady / Mr. John Doe" />
                  <FieldError message={form.formState.errors.fullName?.message} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="line1" className="text-xs font-medium">Street Address / Residence *</Label>
                  <Input id="line1" autoComplete="address-line1" {...form.register("line1")} placeholder="Apartment, suite, building, street" />
                  <FieldError message={form.formState.errors.line1?.message} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="line2" className="text-xs font-medium">Floor / Villa / Gate Code (optional)</Label>
                  <Input id="line2" autoComplete="address-line2" {...form.register("line2")} placeholder="Floor 14, Penthouse 4B" />
                  <FieldError message={form.formState.errors.line2?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city" className="text-xs font-medium">City *</Label>
                  <Input id="city" autoComplete="address-level2" {...form.register("city")} placeholder="Dubai / London / New York" />
                  <FieldError message={form.formState.errors.city?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="region" className="text-xs font-medium">State / Emirate / County</Label>
                  <Input id="region" autoComplete="address-level1" {...form.register("region")} placeholder="Dubai" />
                  <FieldError message={form.formState.errors.region?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="postalCode" className="text-xs font-medium">Postal Code *</Label>
                  <Input id="postalCode" autoComplete="postal-code" {...form.register("postalCode")} placeholder="00000" />
                  <FieldError message={form.formState.errors.postalCode?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-xs font-medium">Country / Region *</Label>
                  <Input id="country" autoComplete="country-name" {...form.register("country")} placeholder="United Arab Emirates" />
                  <FieldError message={form.formState.errors.country?.message} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="phone" className="text-xs font-medium">Mobile Phone (For courier updates)</Label>
                  <Input id="phone" type="tel" autoComplete="tel" {...form.register("phone")} placeholder="+971 50 000 0000" />
                  <FieldError message={form.formState.errors.phone?.message} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Delivery Speed & Courier Options */}
        <Card className="rounded-2xl border border-border/80 shadow-soft overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground font-mono">
                2
              </span>
              <CardTitle className="font-serif text-base font-medium">
                Atelier Courier Method
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-5 grid gap-3 sm:grid-cols-2">
            {(Object.keys(SHIPPING_METHODS) as ShippingMethod[]).map((val) => {
              const meta = SHIPPING_METHODS[val];
              const price =
                val === "express"
                  ? EXPRESS_SHIPPING_PRICE
                  : discountedSubtotal >= 10_000
                    ? 0
                    : STANDARD_SHIPPING_PRICE;
              const isSelected = method === val;
              return (
                <label
                  key={val}
                  className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/[0.04] ring-1 ring-primary shadow-sm"
                      : "border-border/80 hover:border-primary/40 bg-card"
                  }`}
                >
                  <input
                    type="radio"
                    value={val}
                    className="mt-1 accent-[var(--color-primary)]"
                    {...form.register("shippingMethod")}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Truck className="size-4 text-primary" /> {meta.label}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-primary">
                        {price === 0 ? "Complimentary" : formatPrice(price)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {meta.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </CardContent>
        </Card>

        {/* Step 3: Payment & Settlement Choice */}
        <Card className="rounded-2xl border border-border/80 shadow-soft overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground font-mono">
                  3
                </span>
                <CardTitle className="font-serif text-base font-medium">
                  Payment & Settlement
                </CardTitle>
              </div>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lock className="size-3 text-emerald-600 dark:text-emerald-400" />
                256-bit SSL Encrypted
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Stripe Card Option */}
              <label
                className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-all ${
                  paymentMethod === "card"
                    ? "border-primary bg-primary/[0.04] ring-1 ring-primary shadow-sm"
                    : "border-border/80 hover:border-primary/40 bg-card"
                }`}
              >
                <input
                  type="radio"
                  value="card"
                  className="mt-1 accent-[var(--color-primary)]"
                  {...form.register("paymentMethod")}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <CreditCard className="size-4 text-primary" /> Card Payment
                    </span>
                    <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Instant
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Stripe 256-bit encrypted portal. Accepts Visa, Mastercard, AMEX & Apple Pay.
                  </p>
                </div>
              </label>

              {/* Cash on Delivery Option */}
              <label
                className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-all ${
                  paymentMethod === "cod"
                    ? "border-primary bg-primary/[0.04] ring-1 ring-primary shadow-sm"
                    : "border-border/80 hover:border-primary/40 bg-card"
                }`}
              >
                <input
                  type="radio"
                  value="cod"
                  className="mt-1 accent-[var(--color-primary)]"
                  {...form.register("paymentMethod")}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Truck className="size-4 text-emerald-600 dark:text-emerald-400" /> Cash on Delivery
                    </span>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Inspection
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    White-glove inspection on delivery. Pay cash or portable card terminal to courier.
                  </p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Step 4: Special Dispatch Instructions */}
        <Card className="rounded-2xl border border-border/80 shadow-soft overflow-hidden">
          <CardHeader className="bg-muted/30 pb-3 border-b border-border/60">
            <CardTitle className="font-serif text-sm font-medium">
              Concierge Dispatch Instructions (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <Textarea
              id="notes"
              rows={2}
              placeholder="Private gate code, building instructions, preferred courier timing…"
              className="resize-none text-xs"
              {...form.register("notes")}
            />
            <FieldError message={form.formState.errors.notes?.message} />

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {NOTE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleAddNoteChip(chip)}
                  className={`text-[11px] rounded-full border px-2.5 py-1 transition-colors ${
                    notesValue?.includes(chip)
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="space-y-3 pt-2">
          <Button
            type="submit"
            size="lg"
            className="w-full h-13 text-sm font-medium tracking-wide uppercase rounded-xl transition-all shadow-md hover:shadow-lg"
            disabled={pending}
          >
            {pending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Authorizing Dispatch…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {paymentMethod === "cod"
                  ? "Confirm Order with Cash on Delivery"
                  : `Authorize Payment · ${formatPrice(total)}`}
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            )}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground text-center">
            <Lock className="size-3.5 text-primary" aria-hidden="true" />
            Stock reserved in real time. Payment authorized via bank-grade SSL encryption.
          </p>
        </div>
      </form>

      {/* Right Column: Order Review, Inline Privilege Code, Guarantee */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="rounded-2xl border border-border/80 shadow-soft overflow-hidden">
          <CardHeader className="bg-muted/30 pb-3 border-b border-border/60">
            <CardTitle className="font-serif text-sm uppercase tracking-wider text-muted-foreground">
              Order Summary ({quote.lines.reduce((acc, l) => acc + l.qty, 0)} items)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Products List */}
            <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {quote.lines.map((line) => (
                <li
                  key={`${line.productId}:${line.variantId ?? ""}`}
                  className="flex items-center gap-3 text-sm"
                >
                  {line.imageUrl ? (
                    <Image
                      src={line.imageUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <span
                      className="size-12 shrink-0 rounded-lg border border-border bg-muted"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground text-xs sm:text-sm">
                      {line.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {line.variantName ? `${line.variantName} · ` : ""}
                      Qty {line.qty} × {formatPrice(line.unitPrice)}
                    </span>
                  </div>
                  <span className="shrink-0 tabular-nums text-xs sm:text-sm font-medium">
                    {formatPrice(line.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Inline Privilege Promo Code Input */}
            <div className="border-t border-border/60 pt-3 space-y-2">
              {couponResult ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-xs">
                  <div className="flex min-w-0 items-center gap-2 text-primary font-medium">
                    <Tag className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Privilege Code: {couponResult.coupon.code}</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove code"
                    onClick={() => setCoupon(null)}
                    className="text-muted-foreground transition-colors hover:text-destructive p-1"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Privilege code (e.g. NEXORA10)"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      className="text-xs uppercase h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyCoupon()}
                      disabled={couponPending || !couponInput.trim()}
                      className="h-9 px-3 text-xs"
                    >
                      {couponPending ? <Loader2 className="size-3.5 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Sparkles className="size-3 text-primary" />
                    <span>Try atelier code:</span>
                    <button
                      type="button"
                      onClick={() => handleApplyCoupon("NEXORA10")}
                      className="font-mono text-primary font-semibold hover:underline"
                    >
                      NEXORA10
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Price Calculations */}
            <dl className="space-y-2 border-t border-border/60 pt-3 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <dt>Atelier Subtotal</dt>
                <dd className="tabular-nums font-medium text-foreground">
                  {formatPrice(subtotal)}
                </dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-primary font-medium">
                  <dt>Privilege Discount</dt>
                  <dd className="tabular-nums">−{formatPrice(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <dt>White-Glove Courier</dt>
                <dd className="tabular-nums font-medium text-foreground">
                  {shipping === 0 ? "Complimentary" : formatPrice(shipping)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border/80 pt-2.5 text-sm sm:text-base font-semibold text-foreground">
                <dt>Total</dt>
                <dd className="tabular-nums font-mono text-primary">{formatPrice(total)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Luxury Trust Card */}
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-primary font-serif font-medium text-xs">
            <ShieldCheck className="size-4 shrink-0" />
            <span>The NEXORA Atelier Promise</span>
          </div>
          <ul className="text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
            <li className="flex items-start gap-1.5">
              <span className="text-primary font-bold">·</span>
              <span>2-Year Direct Atelier Warranty covering all craftsmanship.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-primary font-bold">·</span>
              <span>30-Day Hassle-Free Returns with complimentary courier pickup.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-primary font-bold">·</span>
              <span>Direct live concierge support via WhatsApp and encrypted portal.</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive mt-1 flex items-center gap-1">
      <Info className="size-3" />
      {message}
    </p>
  );
}
