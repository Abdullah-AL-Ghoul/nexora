import { cn } from "cn";

/**
 * Shimmer skeleton: a light sweep over a muted base instead of flat pulse —
 * reads as "loading" without the harsh blink.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
