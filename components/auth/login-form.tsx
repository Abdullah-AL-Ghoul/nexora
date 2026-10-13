"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/auth/google-button";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Clean URL if user inadvertently submitted GET query params
  useEffect(() => {
    const queryEmail = searchParams.get("email");
    const queryPass = searchParams.get("password");

    if (queryEmail) {
      form.setValue("email", queryEmail);
    }
    if (queryPass) {
      form.setValue("password", queryPass);
    }

    // Clean sensitive credentials from URL query params if browser did a native GET
    if (queryEmail || queryPass) {
      const cleanUrl = window.location.pathname + (searchParams.get("redirect") ? `?redirect=${searchParams.get("redirect")}` : "");
      window.history.replaceState({}, "", cleanUrl);
    }
  }, [searchParams, form]);

  async function onSubmit(values: LoginInput) {
    setPending(true);
    try {
      const { error } = await authClient.signIn.email({
        email: values.email.trim(),
        password: values.password,
      });

      if (error) {
        toast.error(error.message ?? "Unable to sign in. Please verify your credentials.");
        setPending(false);
        return;
      }

      toast.success("Welcome back! Redirecting…");
      const sessionRes = await authClient.getSession();
      const userRole = (sessionRes?.data?.user as { role?: string } | undefined)?.role;

      if (userRole === "ADMIN" || userRole === "MANAGER") {
        router.push("/admin");
      } else {
        router.push(redirectTo || "/shop");
      }
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred during sign in.";
      toast.error(msg);
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        method="POST"
        action="#"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit(onSubmit)(e);
        }}
        className="space-y-4"
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              {...form.register("password")}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide" : "Show"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full gap-2 shadow-md shadow-primary/20 text-sm font-semibold h-11"
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Verifying credentials…
            </>
          ) : (
            "Sign In to Your Account"
          )}
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/80" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
          <span className="bg-card px-3 text-muted-foreground font-medium">Or continue with</span>
        </div>
      </div>

      <GoogleSignInButton callbackURL={redirectTo} />

      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-center">
        <p className="text-xs text-muted-foreground">
          New to NEXORA?{" "}
          <Link
            href="/register"
            className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
          >
            Create an Account
          </Link>
        </p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          Complimentary membership includes order tracking & curated perks.
        </p>
      </div>
    </div>
  );
}

