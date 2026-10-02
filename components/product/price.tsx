import { cn } from "cn";
import { formatPrice, discountPercent } from "@/lib/format";

export function Price({
  price,
  compareAtPrice,
  size = "md",
  className,
}: {
  price: number;
  compareAtPrice?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const percent = discountPercent(price, compareAtPrice ?? null);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-semibold tabular-nums",
          percent ? "text-primary" : "text-foreground",
          size === "sm" && "text-sm",
          size === "md" && "text-base",
          size === "lg" && "text-2xl"
        )}
      >
        {formatPrice(price)}
      </span>
      {percent !== null && compareAtPrice !== undefined && compareAtPrice !== null && (
        <>
          <span className="text-xs text-muted-foreground line-through tabular-nums">
            {formatPrice(compareAtPrice)}
          </span>
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary">
            -{percent}%
          </span>
        </>
      )}
    </div>
  );
}
