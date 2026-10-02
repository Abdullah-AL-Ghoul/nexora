import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All products" },
      { href: "/categories", label: "Categories" },
      { href: "/search", label: "Search" },
      { href: "/shop?sort=rating", label: "Top rated" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create account" },
      { href: "/account", label: "My account" },
      { href: "/forgot-password", label: "Reset password" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="text-lg font-semibold tracking-[0.28em]">
            NEX<span className="text-primary">O</span>RA
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            A modern commerce platform built with Next.js, TypeScript, and PostgreSQL.
            Premium by design, precise by engineering.
          </p>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {column.title}
            </h3>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 NEXORA. All rights reserved.</p>
          <p>Secure payments powered by Stripe (test mode).</p>
        </div>
      </div>
    </footer>
  );
}
