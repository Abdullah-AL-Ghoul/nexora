"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Search, X } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPrice } from "@/lib/format";

type SearchProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  category: { name: string; slug: string };
  images: { url: string; alt: string | null }[];
};

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Listen for Cmd+K or Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  // Debounced search query
  useEffect(() => {
    if (!open) {
      const resetTimer = setTimeout(() => {
        setQuery("");
        setResults([]);
        setLoading(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      const clearTimer = setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return () => clearTimeout(clearTimer);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          if (!controller.signal.aborted) {
            setResults(data.products || []);
            setLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          setResults([]);
          setLoading(false);
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  function handleSelect(href: string) {
    onOpenChange(false);
    startTransition(() => {
      router.push(href);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      handleSelect(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border-border bg-card shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Instant Search</DialogTitle>
          <DialogDescription>Quick search through the NEXORA catalog.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex items-center border-b border-border px-4 py-3">
          <Search className="size-5 shrink-0 text-primary mr-3" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands, essentials… (Press Enter)"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear query"
            >
              <X className="size-4" />
            </button>
          )}
          <span className="ml-3 hidden sm:inline-flex rounded border border-border/80 bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </span>
        </form>

        <div className="max-h-96 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Searching…
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {query ? "Matching Products" : "Trending Essentials"}
              </p>
              {results.map((product) => {
                const img = product.images[0]?.url;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelect(`/product/${product.slug}`)}
                    className="flex w-full items-center gap-3.5 rounded-lg p-2 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/80 focus-visible:outline-none"
                  >
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                      {img ? (
                        <Image src={img} alt={product.name} fill sizes="44px" className="object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground/50">
                          N/A
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{product.category.name}</p>
                      <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-primary">
                      {formatPrice(product.price)}
                    </span>
                  </button>
                );
              })}

              {query && (
                <div className="pt-2 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => handleSelect(`/search?q=${encodeURIComponent(query.trim())}`)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    <span>View all results for &ldquo;{query}&rdquo;</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : query ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No products found for &ldquo;{query}&rdquo;. Try another term.
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Type to search products or categories…
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
