import type { Metadata } from "next";
import Link from "next/link";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const BRAND_POINTS = [
  {
    icon: Truck,
    title: "Free express shipping",
    body: "Complimentary on every order over $100, tracked end to end.",
  },
  {
    icon: RotateCcw,
    title: "30-day effortless returns",
    body: "Pre-paid labels, full refunds, restocked instantly.",
  },
  {
    icon: ShieldCheck,
    title: "2-year precision warranty",
    body: "Your order history is the proof — no receipts to keep.",
  },
] as const;

/**
 * Split-screen auth shell: the form column (max-w-sm) and a branded panel
 * with the house identity. On small screens the brand panel is dropped.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      {/* Form column */}
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <Link
          href="/"
          className="mb-8 text-2xl font-semibold tracking-[0.28em] text-foreground transition-colors hover:text-primary"
        >
          NEX<span className="text-primary">O</span>RA
        </Link>
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-card">
          {children}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Modern Commerce Platform
        </p>
      </div>

      {/* Brand panel (desktop) */}
      <aside
        aria-hidden="true"
        className="hero-glow relative hidden overflow-hidden border-l border-border bg-card lg:flex lg:flex-col lg:justify-center"
      >
        <div className="relative mx-auto max-w-md px-12">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            The NEXORA Standard
          </p>
          <p className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-foreground">
            Precision-engineered essentials, backed without compromise.
          </p>

          <ul className="mt-10 space-y-5">
            {BRAND_POINTS.map((point) => (
              <li key={point.title} className="flex items-start gap-3.5">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <point.icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{point.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {point.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-12 border-t border-border pt-6">
            <p className="font-mono text-xs text-muted-foreground">
              ★ 4.4 / 5.0 average across verified reviews
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
