import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";

import { Reveal } from "@/lib/motion/reveal";
import type { FeaturedReview } from "@/lib/queries/catalog";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={`size-3.5 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
        />
      ))}
    </div>
  );
}

/** Homepage testimonials — real approved customer reviews, verbatim. */
export function Testimonials({ reviews }: { reviews: FeaturedReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <Reveal as="section" aria-label="Customer testimonials">
      <div className="mb-8 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          Verified Voices
        </span>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          What verified customers say
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {reviews.map((review, index) => (
          <Reveal key={review.id} delay={index * 90}>
            <figure className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card">
              <div className="flex items-center justify-between">
                <Stars rating={review.rating} />
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <BadgeCheck className="size-3.5 text-primary" aria-hidden="true" />
                  Verified purchase
                </span>
              </div>

              <blockquote className="flex-1 text-sm leading-relaxed text-foreground/90">
                “{review.comment}”
              </blockquote>

              <figcaption className="border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{review.authorName}</span>
                {" · on "}
                <Link
                  href={`/product/${review.productSlug}`}
                  className="underline-offset-2 transition-colors hover:text-primary hover:underline"
                >
                  {review.productName}
                </Link>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Reveal>
  );
}
