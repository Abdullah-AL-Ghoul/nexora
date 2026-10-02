import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeading({ title, href, actionLabel }: { title: string; href?: string; actionLabel?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {href && actionLabel && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          {actionLabel}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
