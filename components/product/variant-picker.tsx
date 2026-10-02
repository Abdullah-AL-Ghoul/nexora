"use client";

import { cn } from "cn";
import { formatPrice } from "@/lib/format";

export type VariantOption = {
  id: string;
  name: string;
  priceDelta: number;
  stock: number;
};

export function VariantPicker({
  basePrice,
  variants,
  value,
  onChange,
}: {
  basePrice: number;
  variants: VariantOption[];
  value: string | null;
  onChange: (variantId: string | null) => void;
}) {
  const selected = variants.find((variant) => variant.id === value) ?? null;
  const displayPrice = basePrice + (selected?.priceDelta ?? 0);

  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Options
      </legend>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const active = variant.id === value;
          const soldOut = variant.stock <= 0;
          return (
            <button
              key={variant.id}
              type="button"
              disabled={soldOut}
              aria-pressed={active}
              onClick={() => onChange(active ? null : variant.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground/90 hover:border-primary/50",
                soldOut && "cursor-not-allowed opacity-40 line-through"
              )}
            >
              {variant.name}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-baseline gap-3 text-sm">
        <span className="font-semibold tabular-nums text-primary">{formatPrice(displayPrice)}</span>
        {selected ? (
          selected.stock > 0 && selected.stock <= 3 ? (
            <span className="text-xs text-primary/90">Only {selected.stock} left</span>
          ) : selected.stock <= 0 ? (
            <span className="text-xs text-muted-foreground">Sold out</span>
          ) : null
        ) : (
          <span className="text-xs text-muted-foreground">Select an option</span>
        )}
      </div>
    </fieldset>
  );
}
