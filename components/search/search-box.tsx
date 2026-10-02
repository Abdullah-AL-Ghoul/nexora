"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/search" method="GET" role="search" className="flex w-full max-w-xl gap-2">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder='Try "headphones under 100"'
          aria-label="Search products"
          className="pl-9"
        />
      </div>
      <Button type="submit">Search</Button>
    </form>
  );
}
