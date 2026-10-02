"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ORDER_TRANSITIONS } from "@/lib/admin/order-status";
import { ORDER_STATUS_LABEL } from "@/lib/checkout/status";
import { Button } from "@/components/ui/button";

type OrderStatusKey = keyof typeof ORDER_TRANSITIONS;

export function OrderStatusActions({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: string;
  status: OrderStatusKey;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const nextStatuses = ORDER_TRANSITIONS[status] ?? [];

  async function move(target: OrderStatusKey) {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Unable to update order.");
        return;
      }
      toast.success(`Order marked ${ORDER_STATUS_LABEL[target]}`);
      router.refresh();
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setPending(false);
    }
  }

  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {status === "CANCELLED"
          ? "Cancelled orders are terminal."
          : status === "REFUNDED"
            ? "Refunded orders are terminal."
            : "No further transitions."}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {nextStatuses.map((target) => {
        const isRestock = target === "CANCELLED" || target === "REFUNDED";
        const restockNote =
          isRestock && paymentStatus !== "SUCCEEDED" && target === "REFUNDED"
            ? " (nothing to refund)"
            : "";
        return (
          <Button
            key={target}
            size="sm"
            variant={isRestock ? "destructive" : "default"}
            disabled={pending}
            onClick={() => move(target)}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {ORDER_STATUS_LABEL[target]}
            {restockNote}
          </Button>
        );
      })}
    </div>
  );
}
