"use client";

import { useState, useRef, useCallback, MouseEvent, TouchEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PackageX } from "lucide-react";
import { cn } from "cn";

type CardImage = {
  url: string;
  alt: string | null;
};

export function ProductCardImage({
  images,
  productSlug,
  productName,
  priority = false,
}: {
  images: CardImage[];
  productSlug: string;
  productName: string;
  priority?: boolean;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const total = images.length;
  const currentImage = images[activeIdx] ?? images[0];

  // Mouse scrubbing across horizontal segments (Zara / ASOS style)
  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (total <= 1 || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      const index = Math.min(Math.floor(percentage * total), total - 1);
      setActiveIdx(index);
    },
    [total]
  );

  const handleMouseLeave = useCallback(() => {
    setActiveIdx(0);
  }, []);

  // Previous / Next button handlers with stopPropagation to preserve Link navigation
  const prevImage = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveIdx((prev) => (prev === 0 ? total - 1 : prev - 1));
    },
    [total]
  );

  const nextImage = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveIdx((prev) => (prev === total - 1 ? 0 : prev + 1));
    },
    [total]
  );

  // Mobile Touch Swipe support
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || total <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swipe left -> next
        setActiveIdx((prev) => (prev === total - 1 ? 0 : prev + 1));
      } else {
        // Swipe right -> prev
        setActiveIdx((prev) => (prev === 0 ? total - 1 : prev - 1));
      }
    }
    touchStartX.current = null;
  };

  if (!currentImage) {
    return (
      <div className="flex size-full items-center justify-center bg-muted text-muted-foreground/50">
        <PackageX className="size-10" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative size-full select-none"
    >
      <Link
        href={`/product/${productSlug}`}
        prefetch={true}
        className="relative block size-full"
        aria-label={productName}
        tabIndex={-1}
      >
        {/* Render active image with silky crossfade */}
        {images.map((img, idx) => (
          <Image
            key={img.url + idx}
            src={img.url}
            alt={img.alt || productName}
            fill
            priority={priority && idx === 0}
            loading={idx <= 1 ? (priority && idx === 0 ? undefined : "eager") : "lazy"}
            decoding="async"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn(
              "object-cover transition-opacity duration-300 ease-out",
              idx === activeIdx ? "opacity-100 z-10 scale-100 group-hover:scale-105" : "opacity-0 z-0 scale-100 pointer-events-none"
            )}
          />
        ))}
      </Link>

      {/* Segmented Scrubbing Indicators (Stories / Zara style) */}
      {total > 1 && (
        <div className="absolute inset-x-3 bottom-2.5 z-20 flex items-center justify-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none">
          {images.map((_, idx) => (
            <span
              key={idx}
              className={cn(
                "h-1 rounded-full transition-all duration-200 shadow-xs",
                idx === activeIdx
                  ? "w-5 bg-foreground"
                  : "w-1.5 bg-foreground/35"
              )}
            />
          ))}
        </div>
      )}

      {/* Quick Prev/Next Arrow Buttons on Hover */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={prevImage}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 shadow-md backdrop-blur-sm transition-all duration-200 hover:bg-background hover:scale-110 group-hover:opacity-100 cursor-pointer"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={nextImage}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 shadow-md backdrop-blur-sm transition-all duration-200 hover:bg-background hover:scale-110 group-hover:opacity-100 cursor-pointer"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
