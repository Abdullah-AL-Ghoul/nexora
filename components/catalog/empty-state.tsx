import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <SearchX className="size-10 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionHref && (
        <Button asChild variant="outline" className="mt-2">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
