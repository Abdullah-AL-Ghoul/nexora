"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Role = "CUSTOMER" | "MANAGER" | "ADMIN";

export function UserControls({
  userId,
  role,
  isActive,
  isSelf,
  isLastAdmin,
}: {
  userId: string;
  role: Role;
  isActive: boolean;
  isSelf: boolean;
  isLastAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"role" | "active" | null>(null);

  async function patch(payload: { role?: Role; isActive?: boolean }, kind: "role" | "active") {
    if (pending) return;
    setPending(kind);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Unable to update user.");
        return;
      }
      toast.success("User updated");
      router.refresh();
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setPending(null);
    }
  }

  const roleLocked = isSelf || (role === "ADMIN" && isLastAdmin);
  const activeLocked = isSelf;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Change role"
        value={role}
        disabled={roleLocked || pending !== null}
        onChange={(event) => patch({ role: event.target.value as Role }, "role")}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="CUSTOMER">Customer</option>
        <option value="MANAGER">Manager</option>
        <option value="ADMIN">Admin</option>
      </select>

      <button
        type="button"
        disabled={activeLocked || pending !== null}
        onClick={() => patch({ isActive: !isActive }, "active")}
        className={
          isActive
            ? "inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/40 px-3 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            : "inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-600/40 px-3 text-sm text-emerald-700 transition-colors hover:bg-emerald-600/10 disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {pending === "active" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : null}
        {isActive ? "Disable" : "Enable"}
      </button>

      {isSelf && (
        <span className="text-xs text-muted-foreground">your own account</span>
      )}
      {!isSelf && isLastAdmin && role === "ADMIN" && (
        <span className="text-xs text-muted-foreground">last admin</span>
      )}
    </div>
  );
}
