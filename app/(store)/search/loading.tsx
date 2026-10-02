import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function StoreLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <div className="hidden flex-col gap-3 lg:flex">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
          <Skeleton className="mt-4 h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-44" />
          </div>
          <div className="mt-6">
            <ProductGridSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
