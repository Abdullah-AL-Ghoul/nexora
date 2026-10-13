"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ORDER_TRANSITIONS } from "@/lib/admin/order-status";
import { ORDER_STATUS_LABEL } from "@/lib/checkout/status";
import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/generated/prisma/client";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DELIVERED: "secondary",
  SHIPPED: "default",
  PROCESSING: "outline",
  PAID: "default",
  PENDING: "outline",
  CANCELLED: "destructive",
  REFUNDED: "destructive",
};

export function QuickOrderStatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [loading, setLoading] = useState(false);

  const availableTargets = ORDER_TRANSITIONS[currentStatus] ?? [];

  async function handleChange(newStatus: string) {
    if (!newStatus || newStatus === status || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Failed to update status");
        return;
      }
      setStatus(newStatus as OrderStatus);
      const label = ORDER_STATUS_LABEL[newStatus as keyof typeof ORDER_STATUS_LABEL] ?? newStatus;
      toast.success(`Order moved to ${label}`);
      router.refresh();
    } catch {
      toast.error("Network error updating order");
    } finally {
      setLoading(false);
    }
  }

  if (availableTargets.length === 0) {
    return (
      <Badge variant={statusColors[status] ?? "secondary"} className="text-xs">
        {ORDER_STATUS_LABEL[status] ?? status}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={status}
        disabled={loading}
        onChange={(e) => handleChange(e.target.value)}
        className="h-7 rounded border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50"
      >
        <option value={status}>{ORDER_STATUS_LABEL[status] ?? status} (Current)</option>
        {availableTargets.map((target) => (
          <option key={target} value={target}>
            → Move to {ORDER_STATUS_LABEL[target] ?? target}
          </option>
        ))}
      </select>
      {loading && <Loader2 className="size-3 animate-spin text-primary" />}
    </div>
  );
}
