"use client";

import { useRef, useState, useCallback, useEffect, MouseEvent, TouchEvent } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Maximize2, X, ZoomIn } from "lucide-react";

import { cn } from "cn";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

type GalleryImage = { id: string; url: string; alt: string | null };

export function ProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const [selected, setSelected] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchStartX = useRef<number | null>(null);

  const total = images.length;
  const active = images[selected] ?? images[0];

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!mainContainerRef.current) return;
    const rect = mainContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomOrigin({ x, y });
    setIsZooming(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsZooming(false);
  }, []);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        setLightboxIdx((prev) => (prev === total - 1 ? 0 : prev + 1));
      } else if (e.key === "ArrowLeft") {
        setLightboxIdx((prev) => (prev === 0 ? total - 1 : prev - 1));
      } else if (e.key === "Escape") {
        setLightboxOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, total]);

  // Mobile Touch Swiping on PDP
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || total <= 1) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        setSelected((prev) => (prev === total - 1 ? 0 : prev + 1));
      } else {
        setSelected((prev) => (prev === 0 ? total - 1 : prev - 1));
      }
    }
    touchStartX.current = null;
  };

  if (!active) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
        No image available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main Image Container with Magnifier & Lightbox Trigger */}
      <div
        ref={mainContainerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          setLightboxIdx(selected);
          setLightboxOpen(true);
        }}
        className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted cursor-zoom-in select-none"
      >
        <Image
          key={active.id}
          src={active.url}
          alt={active.alt || productName}
          fill
          priority
          loading="eager"
          sizes="(max-width: 1024px) 100vw, 50vw"
          style={{
            transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
          }}
          className={cn(
            "object-cover transition-transform duration-200 ease-out",
            isZooming ? "scale-225" : "scale-100"
          )}
        />

        {/* Expand / Lightbox Action Icon */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxIdx(selected);
            setLightboxOpen(true);
          }}
          aria-label="Expand image to fullscreen"
          className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-lg bg-background/80 text-foreground shadow-md backdrop-blur-md transition-all hover:bg-background hover:scale-105 opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          <Maximize2 className="size-4" aria-hidden="true" />
        </button>

        {/* Hover Hint Badge */}
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-background/75 px-2.5 py-1 text-[11px] font-medium text-foreground backdrop-blur-md shadow-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <ZoomIn className="size-3 text-primary" aria-hidden="true" />
          <span>Click to expand · Hover to zoom</span>
        </div>

        {/* Counter Badge */}
        {total > 1 && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-20 rounded-md bg-background/80 px-2 py-0.5 text-xs font-mono font-medium text-foreground backdrop-blur-md shadow-xs tabular-nums">
            {selected + 1} / {total}
          </div>
        )}

        {/* Main Prev/Next Chevrons for Quick Switching */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelected((prev) => (prev === 0 ? total - 1 : prev - 1));
              }}
              aria-label="Previous product image"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex size-9 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 shadow-md backdrop-blur-md transition-all duration-200 hover:bg-background hover:scale-110 group-hover:opacity-100 cursor-pointer"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelected((prev) => (prev === total - 1 ? 0 : prev + 1));
              }}
              aria-label="Next product image"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex size-9 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 shadow-md backdrop-blur-md transition-all duration-200 hover:bg-background hover:scale-110 group-hover:opacity-100 cursor-pointer"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails Filmstrip with Hover & Click Switching */}
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2.5" role="tablist" aria-label="Product images">
          {images.map((image, index) => (
            <button
              key={image.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              aria-selected={index === selected}
              aria-label={`View image ${index + 1}`}
              tabIndex={index === selected ? 0 : -1}
              onClick={() => setSelected(index)}
              onMouseEnter={() => setSelected(index)}
              className={cn(
                "relative size-16 sm:size-20 overflow-hidden rounded-lg border-2 transition-all duration-200 cursor-pointer",
                index === selected
                  ? "border-primary shadow-sm ring-2 ring-primary/20 scale-102"
                  : "border-border/80 hover:border-primary/50 opacity-70 hover:opacity-100"
              )}
            >
              <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Full-Screen Immersive Lightbox Modal */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-5xl w-full sm:max-w-5xl h-[90vh] p-0 border border-border bg-background/95 backdrop-blur-xl flex flex-col justify-between overflow-hidden shadow-2xl"
        >
          <DialogTitle className="sr-only">Product Image Gallery</DialogTitle>

          {/* Lightbox Top Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/80">
            <div>
              <h3 className="font-semibold text-base text-foreground">{productName}</h3>
              <p className="text-xs text-muted-foreground tabular-nums">
                Image {lightboxIdx + 1} of {total}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close lightbox"
              className="flex size-9 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {/* Lightbox Main Stage */}
          <div className="relative flex-1 w-full flex items-center justify-center p-4 overflow-hidden">
            <div className="relative size-full max-h-[65vh]">
              {images[lightboxIdx] && (
                <Image
                  src={images[lightboxIdx].url}
                  alt={images[lightboxIdx].alt || productName}
                  fill
                  priority
                  className="object-contain"
                  sizes="(max-width: 1280px) 100vw, 1200px"
                />
              )}
            </div>

            {/* Lightbox Prev / Next Arrows */}
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setLightboxIdx((prev) => (prev === 0 ? total - 1 : prev - 1))}
                  aria-label="Previous image"
                  className="absolute left-6 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-background/80 text-foreground border border-border/80 shadow-lg backdrop-blur-md hover:bg-background hover:scale-110 transition-all cursor-pointer"
                >
                  <ChevronLeft className="size-6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxIdx((prev) => (prev === total - 1 ? 0 : prev + 1))}
                  aria-label="Next image"
                  className="absolute right-6 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-background/80 text-foreground border border-border/80 shadow-lg backdrop-blur-md hover:bg-background hover:scale-110 transition-all cursor-pointer"
                >
                  <ChevronRight className="size-6" aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          {/* Lightbox Bottom Thumbnails Filmstrip */}
          {total > 1 && (
            <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-border/80 bg-muted/30 overflow-x-auto">
              {images.map((image, idx) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setLightboxIdx(idx)}
                  className={cn(
                    "relative size-16 shrink-0 overflow-hidden rounded-md border-2 transition-all cursor-pointer",
                    idx === lightboxIdx
                      ? "border-primary shadow-sm ring-2 ring-primary/25 scale-105"
                      : "border-border/60 opacity-60 hover:opacity-100"
                  )}
                >
                  <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
