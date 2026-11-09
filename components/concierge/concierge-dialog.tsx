"use client";

import { useState } from "react";
import { Sparkles, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ConsultationType = "viewing" | "sizing" | "acquisition" | "styling";

const CONSULTATION_TYPES: { value: ConsultationType; label: string }[] = [
  { value: "viewing", label: "Private Showroom Viewing" },
  { value: "sizing", label: "Custom Sizing & Engraving" },
  { value: "acquisition", label: "Rare Piece Acquisition" },
  { value: "styling", label: "Bridal & High-Jewelry Styling" },
];

export function ConciergeDialog({
  productName,
  productSlug,
  children,
}: {
  productName?: string;
  productSlug?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const form = e.currentTarget;
    const data = new FormData(form);

    setSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: String(data.get("fullName") ?? "").trim(),
          email: String(data.get("email") ?? "").trim(),
          phone: String(data.get("phone") ?? "").trim(),
          type: String(data.get("type") ?? "viewing"),
          preferredDate: String(data.get("preferredDate") ?? "").trim(),
          notes: String(data.get("notes") ?? "").trim(),
          productName: productName ?? "",
          productSlug: productSlug ?? "",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setFormError(
          payload?.error ??
            "Your request could not be recorded. Please try again in a moment."
        );
        return;
      }

      setSubmitted(true);
    } catch {
      setFormError("Network error — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const handleReset = () => {
    setSubmitted(false);
    setFormError(null);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setSubmitted(false);
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {children ?? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-primary/30 text-xs font-serif text-primary hover:bg-primary/5"
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>Private Consultation</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md border-border bg-card p-6 shadow-2xl">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="size-3.5" />
            <span>NEXORA Client Advisory</span>
          </div>
          <DialogTitle className="font-serif text-2xl font-bold tracking-tight text-foreground">
            {productName ? "Bespoke Inquiry" : "Private Client Advisory"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {productName
              ? `Request a personal viewing or bespoke consultation for "${productName}".`
              : "Request white-glove advisory, rare timepiece acquisitions, and custom high-jewelry styling."}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-6" />
            </div>
            <h4 className="font-serif text-lg font-semibold text-foreground">
              Request Recorded
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your consultation request has been saved to our client book. A client
              advisor will review it and reach out using the contact details you
              provided.
            </p>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-left text-xs text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                <span>White-Glove Discretion</span>
              </div>
              All private viewings include complimentary insured courier handling and an
              authorized certificate of authenticity.
            </div>
            <Button onClick={handleReset} className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-2 space-y-4" noValidate={false}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="concierge-name" className="text-xs">
                  Full Name
                </Label>
                <Input
                  id="concierge-name"
                  name="fullName"
                  autoComplete="name"
                  placeholder="e.g. Eleanor Vance"
                  required
                  minLength={2}
                  maxLength={80}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="concierge-phone" className="text-xs">
                  Phone (WhatsApp / Call)
                </Label>
                <Input
                  id="concierge-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+1 (555) 000-0000"
                  required
                  minLength={7}
                  maxLength={24}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="concierge-email" className="text-xs">
                Email Address
              </Label>
              <Input
                id="concierge-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="client@example.com"
                required
                maxLength={200}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="concierge-type" className="text-xs">
                  Consultation Focus
                </Label>
                <select
                  id="concierge-type"
                  name="type"
                  defaultValue="viewing"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {CONSULTATION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="concierge-date" className="text-xs">
                  Preferred Date
                </Label>
                <Input
                  id="concierge-date"
                  name="preferredDate"
                  type="date"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="concierge-notes" className="text-xs">
                Special Requests or Inquiries
              </Label>
              <Textarea
                id="concierge-notes"
                name="notes"
                rows={3}
                maxLength={2000}
                placeholder="Include any specific preferences (e.g., wrist diameter, ring size, or custom packaging)..."
                className="resize-none text-xs"
              />
            </div>

            {formError && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {formError}
              </p>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1 text-xs">
                {submitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    <span>Sending…</span>
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
