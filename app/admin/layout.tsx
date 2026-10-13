import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { requireRole } from "@/lib/auth/guards";

/**
 * Admin area guard: every page under /admin runs through this layout.
 * - Unauthenticated visitors are redirected to /login.
 * - Authenticated users without a staff role are redirected to /account.
 * Individual sections tighten this further (e.g. Admin-only pages call
 * `requireRole(ADMIN_ROLES)` themselves).
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["ADMIN", "MANAGER"]);
  const role = String(session.user.role);

  return (
    <div className="flex min-h-screen bg-muted/20">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card/95 backdrop-blur-md p-5 shadow-sm">
        <div className="mb-8 flex items-center justify-between px-1">
          <Link href="/admin" className="group flex flex-col">
            <span className="font-serif text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
              NEXORA
            </span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-primary">
              Executive Portal
            </span>
          </Link>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {role}
          </span>
        </div>

        <AdminNav role={role} />

        <div className="mt-auto border-t border-border pt-4 px-1">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {session.user.name?.[0] ?? session.user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {session.user.name ?? "Administrator"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
        </div>
      </aside>
      <main id="admin-content" tabIndex={-1} className="flex-1 overflow-x-auto p-6 lg:p-10 focus:outline-none">
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
