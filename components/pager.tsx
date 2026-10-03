import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "cn";

type PageItem = number | "gap-start" | "gap-end";

function getPageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const items: PageItem[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) items.push("gap-start");
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end < pageCount - 1) items.push("gap-end");

  items.push(pageCount);
  return items;
}

/**
 * Generic page navigation for any list route (order history, admin tables).
 * The catalog grid uses the catalog-aware <Pagination> instead.
 */
export function Pager({
  page,
  pageCount,
  hrefFor,
  label,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  label: string;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label={label} className="flex items-center justify-center gap-1">
      <Link
        href={hrefFor(page - 1)}
        rel="prev"
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        className={cn(
          "flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary",
          page <= 1 && "pointer-events-none opacity-40"
        )}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        <span className="sr-only">Previous page</span>
      </Link>

      {getPageItems(page, pageCount).map((item) =>
        typeof item === "number" ? (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "flex min-w-9 items-center justify-center rounded-md border px-2 py-1.5 text-sm tabular-nums transition-colors",
              item === page
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
            )}
          >
            {item}
          </Link>
        ) : (
          <span key={item} className="px-1 text-muted-foreground" aria-hidden="true">
            …
          </span>
        )
      )}

      <Link
        href={hrefFor(page + 1)}
        rel="next"
        aria-disabled={page >= pageCount}
        tabIndex={page >= pageCount ? -1 : undefined}
        className={cn(
          "flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary",
          page >= pageCount && "pointer-events-none opacity-40"
        )}
      >
        <ChevronRight className="size-4" aria-hidden="true" />
        <span className="sr-only">Next page</span>
      </Link>
    </nav>
  );
}
