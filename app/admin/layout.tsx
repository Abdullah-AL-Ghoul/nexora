import Link from "next/link";
import { requireRole, type AppRole } from "@/lib/auth/guards";

/**
 * Admin area guard: every page under /admin runs through this layout.
 * - Unauthenticated visitors are redirected to /login.
 * - Authenticated users without a staff role are redirected to /account.
 * Individual sections tighten this further (e.g. Admin-only pages call
 * `requireRole(ADMIN_ROLES)` themselves).
 */

const navItems: { href: string; label: string; roles: AppRole[] }[] = [
  { href: "/admin", label: "Dashboard", roles: ["ADMIN", "MANAGER"] },
  { href: "/admin/orders", label: "Orders", roles: ["ADMIN", "MANAGER"] },
  { href: "/admin/users", label: "Users", roles: ["ADMIN"] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["ADMIN", "MANAGER"]);
  const role = String(session.user.role);
  const visibleNav = navItems.filter((item) => item.roles.includes(role as AppRole));

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card p-4">
        <Link href="/" className="mb-6 px-2 text-lg font-semibold tracking-tight">
          NEXORA <span className="text-xs font-normal text-muted-foreground">Admin</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-border px-2 pt-4 text-xs text-muted-foreground">
          Signed in as <span className="text-foreground">{session.user.email}</span>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
