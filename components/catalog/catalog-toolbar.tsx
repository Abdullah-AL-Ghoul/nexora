"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

import { FiltersPanel, countActiveFilters } from "@/components/catalog/filters-panel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  SORT_OPTIONS,
  parseCatalogParams,
  type SortOption,
} from "@/lib/catalog/params";
import type { CategoryCard } from "@/lib/queries/catalog";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  popular: "Most Popular",
  rating: "Top Rated",
};

export function CatalogToolbar({
  total,
  noun,
  categories,
}: {
  total: number;
  noun: string;
  categories: CategoryCard[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sort = parseCatalogParams(
    Object.fromEntries(searchParams.entries())
  ).sort as SortOption;
  const activeCount = countActiveFilters(searchParams);

  function changeSort(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === "newest") sp.delete("sort");
    else sp.set("sort", value);
    sp.delete("page");
    const query = sp.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        <span className="font-medium text-foreground tabular-nums">{total}</span>{" "}
        {total === 1 ? noun : `${noun}s`}
      </p>

      <div className="flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filters
              {activeCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                  {activeCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Narrow down the catalog.</SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <FiltersPanel categories={categories} />
            </div>
          </SheetContent>
        </Sheet>

        <Select value={sort} onValueChange={changeSort}>
          <SelectTrigger size="sm" className="w-36 sm:w-44" aria-label="Sort products">
            <SelectValue>{SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {SORT_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
