"use client";

import { useSyncExternalStore } from "react";
import { cn } from "cn";
import { formatPrice, discountPercent } from "@/lib/format";
import { useCurrency } from "@/components/currency/currency-provider";

const emptySubscribe = () => () => {};

export function Price({
  price,
  compareAtPrice,
  size = "md",
  className,
}: {
  price: number;
  compareAtPrice?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { formatPrice: formatCustomPrice } = useCurrency();
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const displayPrice = isHydrated ? formatCustomPrice(price) : formatPrice(price);
  const displayComparePrice = compareAtPrice
    ? isHydrated
      ? formatCustomPrice(compareAtPrice)
      : formatPrice(compareAtPrice)
    : null;

  const percent = discountPercent(price, compareAtPrice ?? null);

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-semibold tabular-nums",
          percent ? "text-primary" : "text-foreground",
          size === "sm" && "text-sm",
          size === "md" && "text-base",
          size === "lg" && "text-2xl"
        )}
      >
        {displayPrice}
      </span>
      {percent !== null && displayComparePrice && (
        <>
          <span className="text-xs text-muted-foreground line-through tabular-nums">
            {displayComparePrice}
          </span>
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary">
            -{percent}%
          </span>
        </>
      )}
    </div>
  );
}
