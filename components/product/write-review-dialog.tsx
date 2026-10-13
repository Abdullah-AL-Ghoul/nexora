"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, MessageSquarePlus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";

export function WriteReviewDialog({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast.error("Please enter a few words about your experience.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          rating,
          comment: comment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Please sign in to write an artisan review.", {
            action: {
              label: "Sign in",
              onClick: () => router.push(`/login?redirect=/product/${productId}`),
            },
          });
          return;
        }
        throw new Error(data.error || "Failed to submit review");
      }

      toast.success("Thank you! Your client review has been published.");
      setComment("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/5"
        >
          <MessageSquarePlus className="size-3.5" />
          <span>Write a Review</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md border-border bg-card p-6 shadow-xl">
        <DialogHeader className="text-left">
          <DialogTitle className="font-serif text-xl font-bold tracking-tight text-foreground">
            Share Your Experience
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Reviewing &ldquo;{productName}&rdquo;. Your feedback assists our atelier artisans and collectors worldwide.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Your Rating</Label>
            <div className="flex items-center gap-1.5 py-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    className="p-1 text-muted-foreground/40 transition-colors hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={cn(
                        "size-5 transition-colors",
                        filled
                          ? "fill-primary text-primary"
                          : "fill-transparent text-muted-foreground/40"
                      )}
                    />
                  </button>
                );
              })}
              <span className="ml-2 text-xs font-semibold text-foreground">
                {hoverRating || rating} / 5
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-comment" className="text-xs font-medium">
              Client Feedback
            </Label>
            <Textarea
              id="review-comment"
              name="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Detail the craft, finishing, accuracy, or personal impressions of this piece..."
              rows={4}
              required
              className="resize-none text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Reviews from verified buyers receive an official authentication badge.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="text-xs">
              {loading ? "Publishing…" : "Submit Review"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
