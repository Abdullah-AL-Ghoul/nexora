import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { AuthAnimatedBackground } from "@/components/auth/auth-animated-background";
import { AuthBrandShowcase } from "@/components/auth/auth-brand-showcase";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr] relative overflow-hidden">
      {/* Form column */}
      <div className="relative flex flex-col items-center justify-between px-6 py-10 sm:px-12 overflow-hidden">
        {/* Animated background ambient light & floating celestial motif */}
        <AuthAnimatedBackground />

        {/* Top Header */}
        <div className="relative z-10 w-full max-w-md flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2"
          >
            <span className="font-serif text-2xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
              NEXORA
            </span>
            <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-semibold tracking-widest uppercase text-primary">
              Atelier
            </span>
          </Link>
          <Link
            href="/shop"
            className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <span>← Return to boutique</span>
          </Link>
        </div>

        {/* Center Card with Glassmorphic Luxury Finish */}
        <div className="relative z-10 my-auto w-full max-w-md py-8">
          <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/90 p-8 sm:p-10 shadow-lift backdrop-blur-2xl">
            <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 size-56 rounded-full bg-primary/5 blur-3xl" />
            {children}
          </div>
        </div>

        {/* Bottom Security Footer */}
        <div className="relative z-10 w-full max-w-md flex items-center justify-between text-xs text-muted-foreground/80 border-t border-border/40 pt-4">
          <div className="flex items-center gap-1.5">
            <Lock className="size-3.5 text-primary" />
            <span>256-Bit Encrypted Security</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </div>

      {/* Brand panel (desktop animated showcase) */}
      <AuthBrandShowcase />
    </div>
  );
}
