"use client";

import { Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OrderPrintButton({ orderNumber }: { orderNumber: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/5 print:hidden"
      aria-label={`Print luxury invoice and certificate for order ${orderNumber}`}
    >
      <Printer className="size-3.5" />
      <span>Print Atelier Certificate & Invoice</span>
    </Button>
  );
}
