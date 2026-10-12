"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Clock, Eye, RotateCcw, ShieldCheck, Truck } from "lucide-react";

function getEstimatedDeliveryDate(): string {
  const delivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return delivery.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function getInitialViewers(): number {
  return 12 + Math.floor((new Date().getMinutes() * 7) % 15);
}

export function ProductTrustBadges({ stock }: { stock: number }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 3,
    minutes: 42,
    seconds: 15,
  });

  const [deliveryDate] = useState<string>(getEstimatedDeliveryDate);
  const [viewersCount] = useState<number>(getInitialViewers);

  useEffect(() => {
    // Live countdown timer ticking down
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 4, minutes: 0, seconds: 0 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 text-xs">
      {/* Low stock urgency alert */}
      {stock > 0 && stock <= 5 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-medium">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>Hurry! Only {stock} units left in stock.</span>
        </div>
      )}

      {/* Live Dispatch Countdown & Delivery Date */}
      <div className="flex items-start gap-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Clock className="size-4" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="font-medium text-foreground">
            Order within{" "}
            <span className="font-semibold text-primary font-mono tabular-nums">
              {String(timeLeft.hours).padStart(2, "0")}h {String(timeLeft.minutes).padStart(2, "0")}m {String(timeLeft.seconds).padStart(2, "0")}s
            </span>
          </p>
          <p className="text-muted-foreground">
            Get it delivered by <strong className="font-semibold text-foreground">{deliveryDate}</strong> with Express Shipping.
          </p>
        </div>
      </div>

      {/* Social Proof Live Viewers */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <Eye className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-foreground">{viewersCount} people</strong> are looking at this right now.
        </span>
      </div>

      {/* Trust Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <Truck className="size-3.5 text-primary shrink-0" aria-hidden="true" />
          <span>Complimentary shipping over $100</span>
        </div>
        <div className="flex items-center gap-2">
          <RotateCcw className="size-3.5 text-primary shrink-0" aria-hidden="true" />
          <span>30-day hassle-free returns</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-primary shrink-0" aria-hidden="true" />
          <span>2-year official warranty</span>
        </div>
      </div>
    </div>
  );
}
