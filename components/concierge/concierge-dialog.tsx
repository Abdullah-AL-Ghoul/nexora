"use client";

import { useState } from "react";
import { Sparkles, CheckCircle2, ShieldCheck } from "lucide-react";
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

export function ConciergeDialog({
  productName,
  children,
}: {
  productName?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    // Simulate concierge advisory dispatch
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      toast.success("Consultation inquiry received. A Senior Client Advisor will reach out shortly.");
    }, 800);
  };

  const handleReset = () => {
    setSubmitted(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSubmitted(false); }}>
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
            <span>NEXORA Haute Horlogerie Atelier</span>
          </div>
          <DialogTitle className="font-serif text-2xl font-bold tracking-tight text-foreground">
            {productName ? "Bespoke Inquiry" : "Private Client Advisory"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {productName
              ? `Schedule a personal viewing or bespoke consultation for "${productName}".`
              : "Experience white-glove advisory, rare timepiece acquisitions, and custom high-jewelry styling."}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-6" />
            </div>
            <h4 className="font-serif text-lg font-semibold text-foreground">
              Request Confirmed
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your appointment request has been assigned to a Senior Client Advisor. You will receive a direct concierge confirmation within 2 hours.
            </p>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-left text-xs text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground font-medium mb-1">
                <ShieldCheck className="size-4 text-primary" />
                <span>White-Glove Discretion</span>
              </div>
              All private viewings include complimentary insured courier handling and an authorized Horology Certificate.
            </div>
            <Button onClick={handleReset} className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-2 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="concierge-name" className="text-xs">
                  Full Name
                </Label>
                <Input
                  id="concierge-name"
                  name="fullName"
                  placeholder="e.g. Eleanor Vance"
                  required
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
                  placeholder="+1 (555) 000-0000"
                  required
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
                placeholder="client@luxury.com"
                required
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
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="viewing">Private Showroom Viewing</option>
                  <option value="sizing">Custom Sizing & Engraving</option>
                  <option value="acquisition">Rare Piece Acquisition</option>
                  <option value="styling">Bridal & High-Jewelry Styling</option>
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
                placeholder="Include any specific preferences (e.g., wrist diameter, ring size, or custom packaging)..."
                className="text-xs resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1 text-xs">
                {submitting ? "Booking Advisory…" : "Submit Request"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
