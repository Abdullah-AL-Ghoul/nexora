"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InventoryAdjust({ productId, stock }: { productId: string; stock: number }) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<"RESTOCK" | "ADJUSTMENT">("RESTOCK");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedDelta = Number(delta);
    if (!Number.isInteger(parsedDelta) || parsedDelta === 0) {
      toast.error("Enter a whole number other than 0.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          delta: parsedDelta,
          reason,
          note: note.trim() || null,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Unable to adjust inventory.");
        return;
      }
      toast.success(`Stock updated`);
      setDelta("");
      setNote("");
      router.refresh();
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Adjust inventory</CardTitle>
        <CardDescription>
          Current stock: <span className="font-semibold tabular-nums">{stock}</span> — every change
          is recorded as an inventory transaction with your user id.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="inv-delta">Change (e.g. +20 / −4)</Label>
            <Input
              id="inv-delta"
              type="number"
              step={1}
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              placeholder="20"
              className="w-28"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-reason">Reason</Label>
            <select
              id="inv-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as "RESTOCK" | "ADJUSTMENT")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="RESTOCK">Restock</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>
          <div className="min-w-48 flex-1 space-y-2">
            <Label htmlFor="inv-note">Note (optional)</Label>
            <Input
              id="inv-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Damaged units, recount…"
              maxLength={200}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Apply
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
