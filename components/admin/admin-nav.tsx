"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

import type { AppRole } from "@/lib/auth/guards";

const navItems: { href: string; label: string; roles: AppRole[]; icon: typeof LayoutDashboard }[] = [
  { href: "/admin", label: "Dashboard", roles: ["ADMIN", "MANAGER"], icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", roles: ["ADMIN", "MANAGER"], icon: ShoppingBag },
  { href: "/admin/products", label: "Products", roles: ["ADMIN", "MANAGER"], icon: Package },
  { href: "/admin/users", label: "Users & Roles", roles: ["ADMIN"], icon: Users },
];

/** Admin sidebar nav — client component with active route indicators and icons. */
export function AdminNav({ role }: { role: string }) {
  const pathname = usePathname();
  const visibleNav = navItems.filter((item) => item.roles.includes(role as AppRole));

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-col gap-1.5" aria-label="Admin Navigation">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "flex items-center gap-2.5 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary shadow-sm"
                  : "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
              {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-border/60 pt-4">
        <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Links
        </div>
        <Link
          href="/"
          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Live Boutique
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Store</span>
        </Link>
        <Link
          href="/shop"
          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Package className="size-3.5" aria-hidden="true" />
            Catalog View
          </span>
        </Link>
      </div>
    </div>
  );
}
