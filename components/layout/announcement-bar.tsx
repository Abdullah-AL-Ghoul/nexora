"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Truck, ShieldCheck, Tag, ArrowRight } from "lucide-react";

const ANNOUNCEMENTS = [
  {
    icon: Truck,
    text: "Complimentary Worldwide Express Courier on all orders over $100",
    linkText: "Explore Shop",
    href: "/shop",
  },
  {
    icon: Tag,
    text: "Private Atelier Privilege: Use code LUXURY10 for 10% off your curated selection",
    linkText: "Shop Now",
    href: "/shop",
  },
  {
    icon: ShieldCheck,
    text: "2-Year Precision Horology & Artisan Warranty on every piece",
    linkText: "Learn More",
    href: "/terms",
  },
];

export function AnnouncementBar() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ANNOUNCEMENTS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const current = ANNOUNCEMENTS[index];
  const Icon = current.icon;

  return (
    <div className="relative overflow-hidden bg-primary text-primary-foreground border-b border-primary/20">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center px-4 text-center text-xs font-medium">
        <div
          key={index}
          className="flex items-center justify-center gap-2 transition-all duration-500 ease-out animate-in fade-in slide-in-from-bottom-1"
        >
          <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden="true" />
          <span className="truncate">{current.text}</span>
          <Link
            href={current.href}
            className="hidden items-center gap-0.5 underline underline-offset-4 opacity-90 hover:opacity-100 font-semibold sm:inline-flex"
          >
            {current.linkText} <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
