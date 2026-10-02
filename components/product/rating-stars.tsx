import { Star } from "lucide-react";
import { cn } from "cn";

export function RatingStars({
  rating,
  count,
  className,
  showCount = true,
}: {
  rating: number;
  count?: number;
  className?: string;
  showCount?: boolean;
}) {
  const rounded = Math.round(rating);
  return (
    <div
      className={cn("flex items-center gap-1 text-xs", className)}
      aria-label={`Rated ${rating} out of 5${count !== undefined ? ` (${count} reviews)` : ""}`}
    >
      <span className="flex" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              i < rounded ? "fill-primary text-primary" : "text-muted-foreground/40"
            )}
          />
        ))}
      </span>
      <span className="text-muted-foreground">
        {rating.toFixed(1)}
        {showCount && count !== undefined ? ` (${count})` : ""}
      </span>
    </div>
  );
}
