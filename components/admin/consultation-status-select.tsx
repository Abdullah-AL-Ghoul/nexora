"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  CONSULTATION_STATUS_LABEL,
  CONSULTATION_TRANSITIONS,
} from "@/lib/consultations-constants";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  NEW: "default",
  CONTACTED: "outline",
  CLOSED: "secondary",
};

export function ConsultationStatusSelect({
  requestId,
  currentStatus,
}: {
  requestId: string;
  currentStatus: "NEW" | "CONTACTED" | "CLOSED";
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  const availableTargets = CONSULTATION_TRANSITIONS[status] ?? [];

  async function handleChange(next: string) {
    if (!next || next === status || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/consultations/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Failed to update the request");
        return;
      }
      setStatus(next as typeof currentStatus);
      toast.success(
        `Request moved to ${CONSULTATION_STATUS_LABEL[next as keyof typeof CONSULTATION_STATUS_LABEL] ?? next}`
      );
      router.refresh();
    } catch {
      toast.error("Network error updating the request");
    } finally {
      setLoading(false);
    }
  }

  if (availableTargets.length === 0) {
    return (
      <Badge variant={statusColors[status] ?? "secondary"} className="text-xs">
        {CONSULTATION_STATUS_LABEL[status] ?? status}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={status}
        disabled={loading}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Consultation status"
        className="h-7 cursor-pointer rounded border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      >
        <option value={status}>
          {CONSULTATION_STATUS_LABEL[status] ?? status} (Current)
        </option>
        {availableTargets.map((target) => (
          <option key={target} value={target}>
            → Move to {CONSULTATION_STATUS_LABEL[target as keyof typeof CONSULTATION_STATUS_LABEL] ?? target}
          </option>
        ))}
      </select>
      {loading && <Loader2 className="size-3 animate-spin text-primary" />}
    </div>
  );
}
