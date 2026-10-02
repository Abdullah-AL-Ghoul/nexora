"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { cn } from "cn";
import { Button } from "@/components/ui/button";

export function WishlistButton({
  productId,
  isAuthenticated,
  initialInWishlist,
}: {
  productId: string;
  isAuthenticated: boolean;
  initialInWishlist: boolean;
}) {
  const router = useRouter();
  const [inWishlist, setInWishlist] = useState(initialInWishlist);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (!isAuthenticated) {
      toast.info("Sign in to save items to your wishlist");
      router.push("/login");
      return;
    }

    const next = !inWishlist;
    setInWishlist(next); // optimistic
    setPending(true);
    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, action: next ? "add" : "remove" }),
      });
      const data: { inWishlist?: boolean; error?: string } = await response.json();
      if (!response.ok) {
        setInWishlist(!next);
        toast.error(data.error ?? "Unable to update wishlist");
        return;
      }
      setInWishlist(data.inWishlist ?? next);
      toast.success(next ? "Saved to wishlist" : "Removed from wishlist");
    } catch {
      setInWishlist(!next);
      toast.error("Network error — please try again");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-pressed={inWishlist}
      aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
      disabled={pending}
      onClick={toggle}
      className="shrink-0"
    >
      <Heart className={cn("size-4", inWishlist && "fill-primary text-primary")} aria-hidden="true" />
    </Button>
  );
}
