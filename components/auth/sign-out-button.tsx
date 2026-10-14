"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  variant = "outline",
  size = "default",
  className,
}: {
  variant?: "outline" | "ghost" | "default" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    try {
      await authClient.signOut();
    } catch {
      // Ignore errors on sign out and clear session immediately
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSignOut}
      disabled={pending}
      className={className}
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin mr-1.5" />
          <span>Signing out…</span>
        </>
      ) : (
        <>
          <LogOut className="size-3.5 mr-1.5 opacity-75" />
          <span>Sign out</span>
        </>
      )}
    </Button>
  );
}
