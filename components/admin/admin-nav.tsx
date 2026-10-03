"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AppRole } from "@/lib/auth/guards";

const navItems: { href: string; label: string; roles: AppRole[] }[] = [
  { href: "/admin", label: "Dashboard", roles: ["ADMIN", "MANAGER"] },
  { href: "/admin/orders", label: "Orders", roles: ["ADMIN", "MANAGER"] },
  { href: "/admin/products", label: "Products", roles: ["ADMIN", "MANAGER"] },
  { href: "/admin/users", label: "Users", roles: ["ADMIN"] },
];

/** Admin sidebar nav — client component so the active route is marked. */
export function AdminNav({ role }: { role: string }) {
  const pathname = usePathname();
  const visibleNav = navItems.filter((item) => item.roles.includes(role as AppRole));

  return (
    <nav className="flex flex-col gap-1">
      {visibleNav.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-md bg-accent px-2 py-1.5 text-sm font-medium text-accent-foreground"
                : "rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
