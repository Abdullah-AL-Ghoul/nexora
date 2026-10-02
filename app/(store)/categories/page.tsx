import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { getCategories, type CategoryCard } from "@/lib/queries/catalog";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse every NEXORA product category.",
};

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {categories.length} collections, curated and quality-checked.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <CategoryCardTile key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}

function CategoryCardTile({ category }: { category: CategoryCard }) {
  return (
    <Link
      href={`/category/${category.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {category.imageUrl && (
          <Image
            src={category.imageUrl}
            alt={category.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <span className="absolute right-3 top-3 rounded bg-background/80 px-2 py-0.5 text-xs tabular-nums text-muted-foreground backdrop-blur">
          {category.productCount} {category.productCount === 1 ? "product" : "products"}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-4">
        <h2 className="font-medium transition-colors group-hover:text-primary">
          {category.name}
        </h2>
        {category.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{category.description}</p>
        )}
      </div>
    </Link>
  );
}
