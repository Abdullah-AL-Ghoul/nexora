"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

/** Newsletter capture wired to POST /api/newsletter (real, deduped storage). */
export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || done) return;
    setPending(true);
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Unable to subscribe right now.");
        return;
      }
      setDone(true);
      setEmail("");
      toast.success("You're on the list — welcome to NEXORA.");
    } catch {
      toast.error("Network error — try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p
        role="status"
        className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary"
      >
        <Mail className="size-4" aria-hidden="true" />
        Subscribed — see you in the next drop.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "w-full" : "flex w-full max-w-md gap-2"}>
      <label htmlFor={compact ? "newsletter-footer" : "newsletter-main"} className="sr-only">
        Email address
      </label>
      <input
        id={compact ? "newsletter-footer" : "newsletter-main"}
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        className="h-11 w-full min-w-0 flex-1 rounded-lg border border-input bg-background px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Subscribe
      </button>
    </form>
  );
}
