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
    <div className="flex min-h-screen">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card p-4">
        <Link href="/" className="mb-6 px-2 text-lg font-semibold tracking-tight">
          NEXORA <span className="text-xs font-normal text-muted-foreground">Admin</span>
        </Link>
        <AdminNav role={role} />
        <div className="mt-auto border-t border-border px-2 pt-4 text-xs text-muted-foreground">
          Signed in as <span className="text-foreground">{session.user.email}</span>
        </div>
      </aside>
      <main id="admin-content" tabIndex={-1} className="flex-1 overflow-x-auto p-8 focus:outline-none">
        {children}
      </main>
    </div>
  );
}
