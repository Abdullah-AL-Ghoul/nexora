"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

export function ProductCardWishlist({
  productId,
  productName,
  initialInWishlist = false,
}: {
  productId: string;
  productName: string;
  initialInWishlist?: boolean;
}) {
  const router = useRouter();
  const [inWishlist, setInWishlist] = useState(initialInWishlist);
  const [pending, setPending] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    const next = !inWishlist;
    setInWishlist(next);
    setPending(true);

    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, action: next ? "add" : "remove" }),
      });

      if (response.status === 401) {
        setInWishlist(!next);
        toast.info("Please sign in to save pieces to your wishlist");
        router.push("/login");
        return;
      }

      if (!response.ok) {
        setInWishlist(!next);
        toast.error("Could not update wishlist");
        return;
      }

      toast.success(next ? `Saved "${productName}" to wishlist` : `Removed from wishlist`);
    } catch {
      setInWishlist(!next);
      toast.error("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={inWishlist ? "Remove from wishlist" : "Save to wishlist"}
      className={cn(
        "group/wish absolute right-2.5 top-2.5 z-20 flex size-8 items-center justify-center rounded-full border border-border/80 bg-background/85 shadow-sm backdrop-blur transition-all duration-200 hover:scale-110 hover:border-primary hover:bg-background cursor-pointer",
        inWishlist && "border-primary/60 bg-background text-primary"
      )}
    >
      <Heart
        className={cn(
          "size-4 transition-all duration-200",
          inWishlist
            ? "fill-primary text-primary scale-110"
            : "text-muted-foreground group-hover/wish:text-primary"
        )}
      />
    </button>
  );
}
