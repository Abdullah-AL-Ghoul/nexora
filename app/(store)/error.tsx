"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-primary">Something went wrong</p>
      <h1 className="text-2xl font-semibold">We couldn&apos;t load this page</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. Your cart and session are safe — try again in a moment.
      </p>
      <Button onClick={reset} className="mt-2">
        Try again
      </Button>
    </div>
  );
}
