import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function StoreNotFound() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-6xl font-semibold text-primary">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The product, category, or page you&apos;re looking for doesn&apos;t exist or is no longer
        available.
      </p>
      <div className="mt-3 flex gap-3">
        <Button asChild>
          <Link href="/shop">Continue shopping</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
