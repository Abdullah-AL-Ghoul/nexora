"use client";

import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Truck, RotateCcw, Star } from "lucide-react";

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

export function AuthBrandShowcase() {
  return (
    <aside
      aria-hidden="true"
      className="relative hidden overflow-hidden border-l border-border/80 bg-gradient-to-br from-card via-card/90 to-primary/[0.08] p-12 lg:p-16 xl:p-20 lg:flex lg:flex-col lg:justify-between select-none"
    >
      {/* Background radial gold glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent" />

      {/* Rotating Background Mechanical Tourbillon Motif */}
      <motion.div
        className="pointer-events-none absolute -right-24 -bottom-24 size-[32rem] rounded-full border border-primary/10 opacity-40 dark:opacity-25"
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute inset-8 rounded-full border border-dashed border-primary/15" />
        <div className="absolute inset-20 rounded-full border border-primary/10" />
        <div className="absolute inset-36 rounded-full border border-dotted border-primary/20" />
        {/* Cardinal Markers */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 size-2 bg-primary/40 rounded-full" />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 size-2 bg-primary/40 rounded-full" />
        <div className="absolute left-2 top-1/2 -translate-y-1/2 size-2 bg-primary/40 rounded-full" />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 size-2 bg-primary/40 rounded-full" />
      </motion.div>

      {/* Floating Header Badge */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative flex items-center gap-2.5 text-primary"
      >
        <motion.div
          animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="flex size-6 items-center justify-center rounded-full bg-primary/10"
        >
          <Sparkles className="size-3.5 text-primary" />
        </motion.div>
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-foreground/90">
          High Horology & Fine Living
        </span>
      </motion.div>

      {/* Core Storytelling Hero Section */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.15, delayChildren: 0.2 },
          },
        }}
        className="relative my-auto max-w-lg space-y-6"
      >
        <motion.h2
          variants={{
            hidden: { opacity: 0, y: 25 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
          }}
          className="font-serif text-4xl font-semibold leading-tight tracking-tight text-foreground xl:text-5xl"
        >
          Timeless craft, <br />
          <span className="bg-gradient-to-r from-primary via-amber-400 to-primary bg-clip-text text-transparent">
            uncompromising
          </span>{" "}
          standards.
        </motion.h2>

        <motion.p
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
          }}
          className="text-sm leading-relaxed text-muted-foreground sm:text-base"
        >
          Join our private circle of patrons to access numbered limited editions, atelier provenance certificates, and expedited worldwide delivery.
        </motion.p>

        {/* Interactive Staggered Feature Cards */}
        <div className="space-y-3.5 pt-4">
          {BRAND_POINTS.map((point, index) => {
            const Icon = point.icon;
            return (
              <motion.div
                key={point.title}
                variants={{
                  hidden: { opacity: 0, x: 30 },
                  visible: {
                    opacity: 1,
                    x: 0,
                    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
                whileHover={{
                  x: 6,
                  scale: 1.015,
                  transition: { type: "spring", stiffness: 400, damping: 25 },
                }}
                className="group flex items-start gap-4 rounded-2xl border border-border/50 bg-background/60 p-4 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:bg-background/90 hover:shadow-glow cursor-default"
              >
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 shrink-0">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {point.title}
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {point.body}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Footer Credentials */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 1 }}
        className="relative border-t border-border/60 pt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"
      >
        <span className="font-mono text-[11px] tracking-wider uppercase text-foreground/80">
          Geneva · London · Dubai · Tokyo
        </span>
        <div className="flex items-center gap-1.5 text-primary font-medium">
          <div className="flex text-amber-500">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="size-3 fill-amber-500 text-amber-500" />
            ))}
          </div>
          <span className="ml-1 text-[11px] text-foreground font-semibold">4.9 / 5.0</span>
          <span className="text-muted-foreground text-[10px]">Patron Satisfaction</span>
        </div>
      </motion.div>
    </aside>
  );
}
