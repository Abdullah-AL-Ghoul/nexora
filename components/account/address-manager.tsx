"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, CheckCircle2, Plus, Edit2, Loader2, Sparkles, Building, Phone, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface AddressData {
  id?: string;
  label?: string;
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
  isDefault?: boolean;
}

export function AddressManager({
  initialAddress,
}: {
  initialAddress: AddressData | null;
}) {
  const router = useRouter();
  const [address, setAddress] = useState<AddressData | null>(initialAddress);
  const [editing, setEditing] = useState(!initialAddress);
  const [loading, setLoading] = useState(false);

  // Form states
  const [fullName, setFullName] = useState(initialAddress?.fullName ?? "");
  const [line1, setLine1] = useState(initialAddress?.line1 ?? "");
  const [line2, setLine2] = useState(initialAddress?.line2 ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [region, setRegion] = useState(initialAddress?.region ?? "");
  const [postalCode, setPostalCode] = useState(initialAddress?.postalCode ?? "");
  const [country, setCountry] = useState(initialAddress?.country ?? "United States");
  const [phone, setPhone] = useState(initialAddress?.phone ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !line1.trim() || !city.trim() || !postalCode.trim() || !country.trim()) {
      toast.error("Please fill in all required shipping address fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: address?.id,
          label: "Primary Atelier Address",
          fullName: fullName.trim(),
          line1: line1.trim(),
          line2: line2.trim() || null,
          city: city.trim(),
          region: region.trim() || null,
          postalCode: postalCode.trim(),
          country: country.trim(),
          phone: phone.trim() || null,
          isDefault: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save address");
      }

      setAddress(data.address);
      setEditing(false);
      toast.success("Default address saved! 1-Click checkout is now enabled.");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message || "An error occurred while saving your address");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    if (address) {
      setFullName(address.fullName);
      setLine1(address.line1);
      setLine2(address.line2 ?? "");
      setCity(address.city);
      setRegion(address.region ?? "");
      setPostalCode(address.postalCode);
      setCountry(address.country);
      setPhone(address.phone ?? "");
      setEditing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg font-semibold text-foreground">
              Primary Shipping & Delivery
            </h3>
            <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary text-[10px] font-medium gap-1">
              <Sparkles className="size-3" />
              1-Click Checkout
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Save your delivery destination once here. At checkout, your orders are pre-filled so you can purchase instantly.
          </p>
        </div>

        {address && !editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            className="gap-1.5 text-xs h-8"
          >
            <Edit2 className="size-3" />
            <span>Edit Address</span>
          </Button>
        )}
      </div>

      {!editing && address ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <MapPin className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  {address.fullName}
                  <span className="text-xs font-normal text-muted-foreground font-mono">
                    ({address.label || "Primary"})
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{address.line1}</p>
                {address.line2 && <p className="text-xs text-muted-foreground">{address.line2}</p>}
                <p className="text-xs text-muted-foreground">
                  {address.city}, {address.region ? `${address.region} ` : ""}{address.postalCode}
                </p>
                <p className="text-xs font-medium text-foreground mt-0.5">{address.country}</p>
              </div>
            </div>

            <Badge variant="secondary" className="gap-1 text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="size-3" />
              Active for Checkout
            </Badge>
          </div>

          {address.phone && (
            <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
              <Phone className="size-3 text-primary/70" />
              <span>Contact Phone for Courier: <strong className="font-mono text-foreground">{address.phone}</strong></span>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-fullName" className="text-xs font-medium flex items-center gap-1.5">
                <User className="size-3 text-muted-foreground" />
                Recipient Full Name *
              </Label>
              <Input
                id="addr-fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Eleanor Vance"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-line1" className="text-xs font-medium flex items-center gap-1.5">
                <Building className="size-3 text-muted-foreground" />
                Street Address *
              </Label>
              <Input
                id="addr-line1"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="742 Evergreen Terrace, Suite 400"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-line2" className="text-xs font-medium">
                Apartment, Suite, Unit (Optional)
              </Label>
              <Input
                id="addr-line2"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                placeholder="Apt 4B / Penthouse"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addr-city" className="text-xs font-medium">
                City *
              </Label>
              <Input
                id="addr-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="New York"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addr-region" className="text-xs font-medium">
                State / Province / Region
              </Label>
              <Input
                id="addr-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="NY"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addr-postalCode" className="text-xs font-medium">
                Postal / ZIP Code *
              </Label>
              <Input
                id="addr-postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="10001"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addr-country" className="text-xs font-medium">
                Country *
              </Label>
              <Input
                id="addr-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="United States"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="addr-phone" className="text-xs font-medium flex items-center gap-1.5">
                <Phone className="size-3 text-muted-foreground" />
                Delivery Contact Phone (Optional)
              </Label>
              <Input
                id="addr-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 019-2834"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            {address && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={loading}
                className="text-xs"
              >
                Cancel
              </Button>
            )}
            <Button type="submit" size="sm" disabled={loading} className="gap-1.5 text-xs">
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving Address…</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  <span>Save Shipping Address</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
