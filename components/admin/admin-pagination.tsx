import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminPagination({
  currentPage,
  pageCount,
  totalItems,
  pageSize,
  basePath,
  searchParams,
}: {
  currentPage: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}) {
  if (pageCount <= 1 && totalItems <= pageSize) return null;

  function buildUrl(page: number) {
    const params = new URLSearchParams();
    if (searchParams) {
      for (const [key, val] of Object.entries(searchParams)) {
        if (val && key !== "page") {
          params.set(key, val);
        }
      }
    }
    if (page > 1) {
      params.set("page", String(page));
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const startItem = totalItems === 0 || currentPage > pageCount ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = totalItems === 0 || currentPage > pageCount ? 0 : Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{startItem}</span> to{" "}
        <span className="font-medium text-foreground">{endItem}</span> of{" "}
        <span className="font-medium text-foreground">{totalItems}</span> results
      </p>

      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
        >
          <Link href={buildUrl(currentPage - 1)} aria-disabled={currentPage <= 1}>
            <ChevronLeft className="size-4 mr-1" />
            Previous
          </Link>
        </Button>

        <span className="text-xs text-muted-foreground px-2">
          Page {currentPage} of {Math.max(1, pageCount)}
        </span>

        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={currentPage >= pageCount}
          className={currentPage >= pageCount ? "pointer-events-none opacity-50" : ""}
        >
          <Link href={buildUrl(currentPage + 1)} aria-disabled={currentPage >= pageCount}>
            Next
            <ChevronRight className="size-4 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
