"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ExportOrdersButton({ status }: { status?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const url = status
        ? `/api/admin/orders/export?status=${encodeURIComponent(status)}`
        : "/api/admin/orders/export";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to export orders");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `nexora-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Orders exported successfully as CSV");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not export orders";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="gap-2 cursor-pointer"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      <span>Export CSV</span>
    </Button>
  );
}
