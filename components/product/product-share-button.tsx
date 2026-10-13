"use client";

import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ProductShareButton({ productName }: { productName: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof window === "undefined") return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `NEXORA — ${productName}`,
          text: `Discover ${productName} at NEXORA Atelier.`,
          url,
        });
        return;
      } catch {
        // Fall back to copy
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleShare}
      aria-label="Share product"
      title="Share piece"
      className="shrink-0 transition-transform active:scale-95"
    >
      {copied ? (
        <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      ) : (
        <Share2 className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
