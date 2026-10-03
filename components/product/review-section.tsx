import { BadgeCheck } from "lucide-react";

import { RatingStars } from "@/components/product/rating-stars";
import { formatDate } from "@/lib/format";
import type { ReviewStats } from "@/lib/queries/catalog";

type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  verifiedPurchase: boolean;
  /** ISO string on cache hits, Date on fresh queries — formatDate accepts both. */
  createdAt: Date | string;
  user: { name: string | null };
};

export function ReviewSection({
  stats,
  reviews,
}: {
  stats: ReviewStats;
  reviews: ReviewItem[];
}) {
  return (
    <section id="reviews" className="scroll-mt-24 border-t border-border pt-8">
      <h2 className="text-lg font-semibold">Reviews</h2>

      <div className="mt-4 grid gap-8 sm:grid-cols-[200px_1fr]">
        <div className="flex flex-col items-start gap-2">
          <p className="text-4xl font-semibold tabular-nums">{stats.average.toFixed(1)}</p>
          <RatingStars rating={stats.average} showCount={false} />
          <p className="text-sm text-muted-foreground">
            {stats.count} {stats.count === 1 ? "review" : "reviews"}
          </p>
        </div>

        <div className="flex flex-col gap-1.5" aria-label="Rating distribution">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = stats.distribution[rating] ?? 0;
            const percent = stats.count > 0 ? Math.round((count / stats.count) * 100) : 0;
            return (
              <div key={rating} className="flex items-center gap-3 text-xs">
                <span className="w-8 text-muted-foreground tabular-nums">{rating} ★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="w-8 text-right text-muted-foreground tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="mt-8 flex flex-col divide-y divide-border">
        {reviews.map((review) => (
          <li key={review.id} className="py-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{review.user.name ?? "Customer"}</span>
                {review.verifiedPurchase && (
                  <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                    <BadgeCheck className="size-3" aria-hidden="true" />
                    Verified purchase
                  </span>
                )}
              </div>
              <time
                dateTime={typeof review.createdAt === "string" ? review.createdAt : review.createdAt.toISOString()}
                className="text-xs text-muted-foreground"
              >
                {formatDate(review.createdAt)}
              </time>
            </div>
            <RatingStars rating={review.rating} showCount={false} className="mt-1.5" />
            {review.comment && <p className="mt-2 text-sm leading-relaxed">{review.comment}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
