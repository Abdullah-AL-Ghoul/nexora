"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Phone, Mail, Shield, Check, Edit2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function ProfileEditor({
  user,
}: {
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    role: string;
    createdAt: Date | string;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      toast.success("Profile details updated successfully");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4">
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground">
            Patron Personal Details
          </h3>
          <p className="text-xs text-muted-foreground">
            Your identity and contact information for atelier communications.
          </p>
        </div>
        {!editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            className="gap-1.5 text-xs h-8"
          >
            <Edit2 className="size-3" />
            <span>Edit Details</span>
          </Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prof-name" className="text-xs font-medium">
                Full Name
              </Label>
              <Input
                id="prof-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Eleanor Vance"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-phone" className="text-xs font-medium">
                Direct Phone / WhatsApp
              </Label>
              <Input
                id="prof-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Registered Email (Primary Login)
            </Label>
            <Input
              value={user.email}
              disabled
              className="h-9 text-xs opacity-60 cursor-not-allowed bg-muted/40"
            />
            <p className="text-[10px] text-muted-foreground">
              To change your primary authentication email, contact concierge security.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => {
                setName(user.name ?? "");
                setPhone(user.phone ?? "");
                setEditing(false);
              }}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="gap-1 text-xs h-8">
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Full Name
            </span>
            <p className="text-sm font-medium text-foreground">{user.name || "—"}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Direct Phone
            </span>
            <p className="text-sm font-medium text-foreground">{user.phone || "Not specified"}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Email Address
            </span>
            <p className="text-sm font-medium text-foreground">{user.email}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Circle Status
            </span>
            <div>
              <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary text-xs">
                Private Atelier Client
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
