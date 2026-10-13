import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, ShieldCheck, Truck, RotateCcw, Lock } from "lucide-react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const BRAND_POINTS = [
  {
    icon: Truck,
    title: "White-Glove Express Courier",
    body: "Fully insured delivery with signature confirmation on all orders over $100.",
  },
  {
    icon: RotateCcw,
    title: "30-Day Effortless Returns",
    body: "Pre-paid luxury return packaging, prompt refunds without interrogation.",
  },
  {
    icon: ShieldCheck,
    title: "2-Year Precision Horology Warranty",
    body: "Backed by master artisans — your encrypted order ledger is your lifetime certificate.",
  },
] as const;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Form column */}
      <div className="flex flex-col items-center justify-between px-6 py-10 sm:px-12">
        <div className="w-full max-w-md flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2"
          >
            <span className="font-serif text-2xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
              NEXORA
            </span>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-widest uppercase text-primary">
              Atelier
            </span>
          </Link>
          <Link
            href="/shop"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            ← Return to boutique
          </Link>
        </div>

        <div className="my-auto w-full max-w-md py-8">
          <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/95 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
            <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 size-56 rounded-full bg-primary/5 blur-3xl" />
            {children}
          </div>
        </div>

        <div className="w-full max-w-md flex items-center justify-between text-xs text-muted-foreground/80 border-t border-border/40 pt-4">
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

      {/* Brand panel (desktop) */}
      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden border-l border-border/80 bg-gradient-to-br from-card via-card/90 to-primary/[0.08] p-16 lg:flex lg:flex-col lg:justify-between"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent" />
        
        <div className="relative flex items-center gap-2 text-primary">
          <Sparkles className="size-4" />
          <span className="text-xs font-semibold uppercase tracking-[0.25em]">
            High Horology & Fine Living
          </span>
        </div>

        <div className="relative my-auto max-w-lg space-y-6">
          <h2 className="font-serif text-4xl font-semibold leading-tight tracking-tight text-foreground xl:text-5xl">
            Timeless craft, <br />
            <span className="text-gold-gradient">uncompromising</span> standards.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Join our private circle of patrons to access numbered limited editions, atelier provenance certificates, and expedited worldwide delivery.
          </p>

          <div className="space-y-4 pt-6">
            {BRAND_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <div key={point.title} className="flex items-start gap-4 rounded-xl border border-border/40 bg-background/50 p-4 backdrop-blur-sm">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{point.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {point.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative border-t border-border/60 pt-6 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">Geneva · London · Dubai · Tokyo</span>
          <span className="text-primary font-medium">★ 4.9 / 5.0 Patron Satisfaction</span>
        </div>
      </aside>
    </div>
  );
}
