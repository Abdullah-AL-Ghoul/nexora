"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CategoryCard } from "@/lib/queries/catalog";

const RATING_OPTIONS = [
  { value: 4, label: "4 & up" },
  { value: 3, label: "3 & up" },
  { value: 2, label: "2 & up" },
  { value: 1, label: "1 & up" },
];

export function countActiveFilters(searchParams: URLSearchParams): number {
  return ["category", "min", "max", "rating", "stock"].filter((key) =>
    searchParams.has(key)
  ).length;
}

export function FiltersPanel({ categories }: { categories: CategoryCard[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") ?? "";
  const currentRating = searchParams.get("rating") ?? "";
  const inStock = searchParams.get("stock") === "1";
  // Remount inputs whenever URL params change so defaults stay in sync.
  const priceFieldKey = searchParams.toString();
  const priceDefaults = {
    min: normalizeDollars(searchParams.get("min")),
    max: normalizeDollars(searchParams.get("max")),
  };

  function hrefWith(patch: Record<string, string | null>): string {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") sp.delete(key);
      else sp.set(key, value);
    }
    sp.delete("page");
    const query = sp.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  /** Canonical category navigation: /category/[slug], preserving other filters. */
  function categoryHref(slug: string): string {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("category");
    sp.delete("page");
    const query = sp.toString();
    return query ? `/category/${slug}?${query}` : `/category/${slug}`;
  }

  function submitPrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const min = String(formData.get("min") ?? "").trim();
    const max = String(formData.get("max") ?? "").trim();
    router.push(hrefWith({ min: min || null, max: max || null }), { scroll: false });
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Category
        </h3>
        <ul className="flex flex-col gap-0.5">
          {categories.map((category) => {
            const active = category.slug === currentCategory;
            return (
              <li key={category.id}>
                <Link
                  href={categoryHref(category.slug)}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground/90 hover:bg-accent hover:text-primary"
                  )}
                  aria-current={active ? "true" : undefined}
                >
                  <span className="truncate">{category.name}</span>
                  <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                    {category.productCount}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Price
        </h3>
        <form onSubmit={submitPrice} className="flex items-center gap-2">
          <Input
            key={`min-${priceFieldKey}`}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="Min"
            aria-label="Minimum price in dollars"
            defaultValue={priceDefaults.min}
            className="h-9"
          />
          <span aria-hidden="true" className="text-muted-foreground">
            –
          </span>
          <Input
            key={`max-${priceFieldKey}`}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="Max"
            aria-label="Maximum price in dollars"
            defaultValue={priceDefaults.max}
            className="h-9"
          />
          <Button type="submit" size="sm" variant="secondary" className="h-9 px-3">
            Go
          </Button>
        </form>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rating
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {RATING_OPTIONS.map((option) => {
            const active = String(option.value) === currentRating;
            return (
              <Link
                key={option.value}
                href={hrefWith({ rating: active ? null : String(option.value) })}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                )}
                aria-pressed={active}
              >
                {option.label} ★
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Availability
        </h3>
        <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={inStock}
            onCheckedChange={(checked) =>
              router.push(hrefWith({ stock: checked === true ? "1" : null }), { scroll: false })
            }
          />
          In stock only
        </Label>
      </section>

      <Button asChild variant="ghost" size="sm" className="justify-start px-2 text-muted-foreground">
        <Link href={pathname}>Clear all filters</Link>
      </Button>
    </div>
  );
}

function normalizeDollars(raw: string | null): string {
  if (!raw) return "";
  return /^\d+(\.\d{1,2})?$/.test(raw) ? raw : "";
}
