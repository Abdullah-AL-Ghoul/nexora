import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ShieldCheck, Sparkles, Store } from "lucide-react";

import { AdminNav } from "@/components/admin/admin-nav";
import { AdminAiCopilot } from "@/components/admin/admin-ai-copilot";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireRole } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Executive Portal — NEXORA Atelier",
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

      {/* Luxury Executive Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/80 bg-card/95 backdrop-blur-md p-5 shadow-sm">
        <div className="mb-8 flex items-center justify-between px-1">
          <Link href="/admin" className="group flex flex-col">
            <span className="font-serif text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
              NEXORA
            </span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-primary">
              Executive Portal
            </span>
          </Link>
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] font-medium">
            {role}
          </Badge>
        </div>

        <AdminNav role={role} />

        {/* Sidebar Bottom: User Profile & 1-Click Sign Out */}
        <div className="mt-auto border-t border-border/70 pt-4 px-1 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-xs font-serif font-bold text-primary border border-primary/20">
              {session.user.name?.[0] ?? session.user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">
                {session.user.name ?? "Administrator"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{session.user.email}</p>
            </div>
          </div>

          <SignOutButton
            variant="outline"
            size="sm"
            className="w-full justify-center text-xs h-8 text-muted-foreground hover:text-destructive hover:border-destructive/40"
          />
        </div>
      </aside>

      {/* Main Content Area with Top Executive Header */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/70 bg-card/90 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-medium text-muted-foreground hidden sm:inline">
                Atelier System Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Link href="/shop" target="_blank" rel="noopener noreferrer">
                <Store className="size-3.5" />
                <span className="hidden sm:inline">View Boutique</span>
                <ExternalLink className="size-2.5 opacity-60" />
              </Link>
            </Button>

            <SignOutButton
              variant="outline"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
            />
          </div>
        </header>

        <main id="admin-content" tabIndex={-1} className="flex-1 overflow-x-auto p-6 lg:p-10 focus:outline-none">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Floating AI Co-Pilot Assistant */}
      <AdminAiCopilot />
    </div>
  );
}
