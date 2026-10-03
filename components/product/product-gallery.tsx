"use client";

import { useRef, useState } from "react";
import Image from "next/image";

import { cn } from "cn";

type GalleryImage = { id: string; url: string; alt: string | null };

export function ProductGallery({ images, productName }: { images: GalleryImage[]; productName: string }) {
  const [selected, setSelected] = useState(0);
  const active = images[selected] ?? images[0];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (!active) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
        No image available
      </div>
    );
  }

  // ARIA tabs pattern: arrow keys move selection and focus, Home/End jump.
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const last = images.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = selected === last ? 0 : selected + 1;
    else if (event.key === "ArrowLeft") next = selected === 0 ? last : selected - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;

    event.preventDefault();
    setSelected(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
        <Image
          key={active.id}
          src={active.url}
          alt={active.alt || productName}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Product images">
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
              onKeyDown={onKeyDown}
              className={cn(
                "relative size-16 overflow-hidden rounded-md border transition-colors",
                index === selected
                  ? "border-primary"
                  : "border-border hover:border-muted-foreground"
              )}
            >
              <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
