"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, ShoppingBag, Star, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/product/price";
import { RatingStars } from "@/components/product/rating-stars";
import { useCartStore } from "@/lib/cart/store";
import type { ProductCardData } from "@/lib/queries/catalog";

export function ProductQuickView({ product }: { product: ProductCardData }) {
  const [open, setOpen] = useState(false);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);

  const images = product.images.length > 0 ? product.images : [{ url: "/placeholder.png", alt: product.name }];
  const currentImg = images[activeImgIdx] ?? images[0];

  function handleAddToCart() {
    addItem({ productId: product.id, variantId: null, qty: 1 });
    setOpen(false);
    openDrawer();
    toast.success(`Added "${product.name}" to cart`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label={`Quick preview for ${product.name}`}
          className="group/qv flex size-8 items-center justify-center rounded-lg border border-border/80 bg-background/90 text-foreground shadow-sm backdrop-blur transition-all duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:scale-105 cursor-pointer"
        >
          <Eye className="size-4" aria-hidden="true" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl overflow-hidden p-0 sm:rounded-2xl border-border bg-card">
        <div className="grid gap-0 md:grid-cols-2">
          {/* Product Media Area */}
          <div className="relative flex flex-col justify-between bg-muted/30 p-6">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-background shadow-xs">
              <Image
                src={currentImg.url}
                alt={currentImg.alt ?? product.name}
                fill
                sizes="(max-width: 768px) 100vw, 380px"
                className="object-cover transition-all duration-300"
              />
            </div>

            {/* Gallery Thumbnails */}
            {images.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.url + idx}
                    type="button"
                    onClick={() => setActiveImgIdx(idx)}
                    className={`relative size-14 shrink-0 overflow-hidden rounded-lg border transition-all ${
                      idx === activeImgIdx
                        ? "border-primary ring-2 ring-primary/20 scale-105"
                        : "border-border/60 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <Image src={img.url} alt="" fill sizes="56px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details Area */}
          <div className="flex flex-col justify-between p-6 sm:p-8">
            <div className="space-y-4">
              <DialogHeader className="text-left space-y-1">
                <Badge variant="outline" className="w-fit text-[11px] uppercase tracking-wider text-muted-foreground">
                  {product.category.name}
                </Badge>
                <DialogTitle className="font-serif text-xl sm:text-2xl font-semibold leading-snug">
                  {product.name}
                </DialogTitle>
              </DialogHeader>

              {product.ratingCount > 0 ? (
                <RatingStars rating={product.ratingAvg} count={product.ratingCount} />
              ) : (
                <span className="text-xs text-muted-foreground">Artisan luxury grade</span>
              )}

              <Price price={product.price} compareAtPrice={product.compareAtPrice} size="lg" />

              <div className="border-t border-border/70 pt-4 text-xs text-muted-foreground space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="size-3.5" />
                  <span>{product.stock > 0 ? `Ready to dispatch (${product.stock} pieces available)` : "Currently out of stock"}</span>
                </div>
                <p className="leading-relaxed line-clamp-3">
                  Handcrafted with relentless attention to detail. Designed for sophisticated everyday distinction and lifelong performance.
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <Button
                type="button"
                size="lg"
                className="w-full gap-2 shadow-md shadow-primary/20"
                disabled={product.stock <= 0}
                onClick={handleAddToCart}
              >
                <ShoppingBag className="size-4" />
                <span>{product.stock > 0 ? "Add to Curated Cart" : "Out of Stock"}</span>
              </Button>

              <Button asChild variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                <Link href={`/product/${product.slug}`} onClick={() => setOpen(false)}>
                  View full specifications & craftsmanship <ArrowRight className="ml-1 size-3" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
