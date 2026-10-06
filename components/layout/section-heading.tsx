import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeading({
  title,
  href,
  actionLabel,
  subtitle,
}: {
  title: string;
  href?: string;
  actionLabel?: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl text-foreground">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm pl-3">
            {subtitle}
          </p>
        )}
      </div>

      {href && actionLabel && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground transition-colors hover:text-primary pl-3 sm:pl-0 mt-1 sm:mt-0"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
