"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Loader2,
  PenSquare,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/product/rating-stars";
import { formatDate } from "@/lib/format";
import type { ReviewStats } from "@/lib/queries/catalog";

export type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  verifiedPurchase: boolean;
  createdAt: Date | string;
  user: { name: string | null };
};

type ProductTabsProps = {
  productId: string;
  productName: string;
  description: string;
  brand: string | null;
  sku: string;
  categoryName: string;
  categorySlug: string;
  stats: ReviewStats;
  initialReviews: ReviewItem[];
  isAuthenticated: boolean;
};

const RATING_LABELS: Record<number, string> = {
  5: "5 stars · Exceptional quality",
  4: "4 stars · Very good",
  3: "3 stars · Average",
  2: "2 stars · Needs improvement",
  1: "1 star · Disappointed",
};

export function ProductTabs({
  productId,
  productName,
  description,
  brand,
  sku,
  categoryName,
  categorySlug,
  stats: initialStats,
  initialReviews,
  isAuthenticated,
}: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<"reviews" | "details" | "shipping">("reviews");
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [stats, setStats] = useState<ReviewStats>(initialStats);
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | null>(null);

  // Review Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formRating, setFormRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [formComment, setFormComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeStarCount = hoverRating ?? formRating;

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formComment.trim()) {
      toast.error("Please enter your review comments");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          rating: formRating,
          comment: formComment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit review");
      }

      toast.success("Thank you! Your review has been submitted.");

      // Optimistically update list
      const newReview: ReviewItem = data.review;
      setReviews((prev) => {
        const filtered = prev.filter((r) => r.id !== newReview.id);
        return [newReview, ...filtered];
      });

      // Update statistics
      const newCount = stats.count + 1;
      const newSum = stats.average * stats.count + formRating;
      const newAvg = Number((newSum / newCount).toFixed(1));
      const newDist = {
        ...stats.distribution,
        [formRating]: (stats.distribution[formRating] ?? 0) + 1,
      };

      setStats({
        count: newCount,
        average: newAvg,
        distribution: newDist,
      });

      setFormComment("");
      setIsFormOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error submitting review";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredReviews = selectedRatingFilter
    ? reviews.filter((r) => r.rating === selectedRatingFilter)
    : reviews;

  return (
    <div id="reviews" className="scroll-mt-20 border-t border-border pt-12">
      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("reviews")}
          className={`flex items-center gap-2 border-b-2 px-6 py-3.5 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "reviews"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Customer Reviews</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-foreground">
            {stats.count}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`border-b-2 px-6 py-3.5 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "details"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Specifications & Details
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shipping")}
          className={`border-b-2 px-6 py-3.5 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "shipping"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Shipping & Returns
        </button>
      </div>

      {/* Tab 1: Reviews */}
      {activeTab === "reviews" && (
        <div className="py-8">
          <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
            {/* Left: Amazon/Apple-Style Rating Breakdown Box */}
            <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm backdrop-blur">
              <h3 className="text-base font-semibold text-foreground">Overall Rating</h3>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-5xl font-extrabold tracking-tight text-foreground tabular-nums">
                  {stats.average.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-muted-foreground">out of 5</span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <RatingStars rating={stats.average} showCount={false} />
                <span className="text-xs text-muted-foreground">
                  ({stats.count} verified customer {stats.count === 1 ? "rating" : "ratings"})
                </span>
              </div>

              {/* Percentage Breakdown Bars */}
              <div className="mt-6 space-y-2.5" aria-label="Customer rating breakdown">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = stats.distribution[star] ?? 0;
                  const percent = stats.count > 0 ? Math.round((count / stats.count) * 100) : 0;
                  const isSelected = selectedRatingFilter === star;

                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setSelectedRatingFilter(isSelected ? null : star)
                      }
                      className={`group flex w-full items-center gap-3 rounded-lg p-1.5 text-xs transition-colors hover:bg-muted/70 cursor-pointer ${
                        isSelected ? "bg-muted font-semibold ring-1 ring-primary/40" : ""
                      }`}
                      title={`Filter by ${star} stars (${count} reviews)`}
                    >
                      <span className="w-12 text-left font-medium text-foreground tabular-nums flex items-center gap-1">
                        <span>{star}</span>
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                      </span>

                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500 group-hover:brightness-110"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <span className="w-10 text-right font-mono text-xs text-muted-foreground tabular-nums group-hover:text-foreground">
                        {percent}%
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedRatingFilter !== null && (
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="text-muted-foreground">
                    Filtered by <strong>{selectedRatingFilter} stars</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedRatingFilter(null)}
                    className="flex items-center gap-1 text-primary hover:underline cursor-pointer"
                  >
                    <X className="size-3" />
                    <span>Clear filter</span>
                  </button>
                </div>
              )}

              {/* Write Review CTA */}
              <div className="mt-6 border-t border-border pt-6">
                <Button
                  onClick={() => setIsFormOpen(!isFormOpen)}
                  variant={isFormOpen ? "secondary" : "default"}
                  className="w-full gap-2 cursor-pointer shadow-sm"
                >
                  <PenSquare className="size-4" aria-hidden="true" />
                  <span>{isFormOpen ? "Close Review Form" : "Write a Customer Review"}</span>
                </Button>
              </div>
            </div>

            {/* Right: Review Form (when open) + Customer Reviews List */}
            <div className="space-y-6">
              {isFormOpen && (
                <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-md transition-all">
                  <h4 className="text-base font-semibold text-foreground">
                    Share your experience with {productName}
                  </h4>

                  {!isAuthenticated ? (
                    <div className="mt-4 rounded-xl border border-border bg-muted/40 p-5 text-center">
                      <p className="text-sm text-muted-foreground">
                        You need to be signed in to submit a verified product review.
                      </p>
                      <Button asChild size="sm" className="mt-3">
                        <Link href="/login">Sign in to write review</Link>
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4">
                      {/* Star Rating Picker */}
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                          Rating
                        </label>
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFormRating(star)}
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(null)}
                              className="p-1 transition-transform hover:scale-125 cursor-pointer focus:outline-none"
                              aria-label={`Select ${star} stars`}
                            >
                              <Star
                                className={`size-6 transition-colors ${
                                  star <= activeStarCount
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/30 hover:text-amber-400/60"
                                }`}
                              />
                            </button>
                          ))}
                          <span className="ml-3 text-xs font-medium text-foreground">
                            {RATING_LABELS[activeStarCount] ?? ""}
                          </span>
                        </div>
                      </div>

                      {/* Comment */}
                      <div>
                        <label
                          htmlFor="review-comment"
                          className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5"
                        >
                          Your Review
                        </label>
                        <textarea
                          id="review-comment"
                          rows={4}
                          value={formComment}
                          onChange={(e) => setFormComment(e.target.value)}
                          placeholder="What did you like or dislike? How is the fit, material, and craftsmanship?"
                          required
                          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsFormOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isSubmitting || !formComment.trim()}
                          className="gap-2"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              <span>Submitting…</span>
                            </>
                          ) : (
                            <span>Submit Review</span>
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Review Feed */}
              {filteredReviews.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
                  <p className="text-sm">
                    {selectedRatingFilter
                      ? `No ${selectedRatingFilter}-star reviews found.`
                      : "No customer reviews yet. Be the first to share your thoughts!"}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredReviews.map((review) => (
                    <li key={review.id} className="py-5 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {review.user.name ?? "Verified Customer"}
                          </span>
                          {review.verifiedPurchase && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <BadgeCheck className="size-3" aria-hidden="true" />
                              Verified Purchase
                            </span>
                          )}
                        </div>
                        <time
                          dateTime={
                            typeof review.createdAt === "string"
                              ? review.createdAt
                              : review.createdAt.toISOString()
                          }
                          className="text-xs text-muted-foreground"
                        >
                          {formatDate(review.createdAt)}
                        </time>
                      </div>

                      <RatingStars rating={review.rating} showCount={false} className="mt-1.5" />

                      {review.comment && (
                        <p className="mt-2.5 text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                          {review.comment}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Specifications & Details */}
      {activeTab === "details" && (
        <div className="py-8">
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Product Narrative</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {description}
              </p>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Specifications</h3>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 text-sm">
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Product SKU</dt>
                  <dd className="font-mono font-medium text-foreground">{sku}</dd>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Manufacturer / Brand</dt>
                  <dd className="font-medium text-foreground">{brand ?? "NEXORA Studio"}</dd>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd className="font-medium text-primary">
                    <Link href={`/category/${categorySlug}`} className="hover:underline">
                      {categoryName}
                    </Link>
                  </dd>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Origin & Authenticity</dt>
                  <dd className="font-medium text-foreground flex items-center gap-1">
                    <ShieldCheck className="size-3.5 text-emerald-500" />
                    <span>100% Guaranteed</span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Shipping & Returns */}
      {activeTab === "shipping" && (
        <div className="py-8">
          <div className="grid gap-6 sm:grid-cols-3 max-w-4xl">
            <div className="rounded-xl border border-border bg-card/60 p-5 space-y-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Truck className="size-5" />
              </div>
              <h4 className="font-semibold text-foreground">Complimentary Shipping</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enjoy free standard courier shipping on all orders totaling $100 or more. Fast dispatched within 24 hours.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card/60 p-5 space-y-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <RotateCcw className="size-5" />
              </div>
              <h4 className="font-semibold text-foreground">30-Day Hassle-Free Returns</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If the item isn&apos;t completely suitable, return it within 30 days in original packaging for a full refund.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card/60 p-5 space-y-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <h4 className="font-semibold text-foreground">2-Year Atelier Warranty</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every piece in our catalog is backed by our full defect coverage and client concierge service.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
