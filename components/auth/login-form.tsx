"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/auth/google-button";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function LoginForm({ redirectTo }: { redirectTo: string }) {
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

    if (queryEmail || queryPass) {
      const cleanUrl =
        window.location.pathname +
        (searchParams.get("redirect") ? `?redirect=${searchParams.get("redirect")}` : "");
      window.history.replaceState({}, "", cleanUrl);
    }
  }, [searchParams, form]);

  async function onSubmit(values: LoginInput) {
    setPending(true);
    try {
      const { data, error } = await authClient.signIn.email({
        email: values.email.trim(),
        password: values.password,
      });

      if (error) {
        toast.error(error.message ?? "Unable to sign in. Please verify your credentials.");
        setPending(false);
        return;
      }

      toast.success("Welcome back! Entering portal…");
      const userRole = (data?.user as { role?: string } | undefined)?.role;
      const destination =
        userRole === "ADMIN" || userRole === "MANAGER" ? "/admin" : redirectTo || "/shop";
      window.location.assign(destination);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred during sign in.";
      toast.error(msg);
      setPending(false);
    }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Animated Header */}
      <motion.div variants={itemVariants} className="space-y-2 text-center pb-1">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/25 text-primary shadow-soft mb-3"
        >
          <Sparkles className="size-6 text-primary" />
        </motion.div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Welcome Back
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Sign in to access your curated orders, wishlist, and private atelier circle.
        </p>
      </motion.div>

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
        {/* Email Input Field */}
        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Email
          </Label>
          <div className="relative group">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="patron@nexora.com"
              {...form.register("email")}
              className="h-11 transition-all duration-200 border-border/80 bg-background/80 focus-visible:border-primary/70 focus-visible:ring-primary/20"
            />
          </div>
          <AnimatePresence>
            {form.formState.errors.email && (
              <motion.p
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                role="alert"
                className="text-xs text-destructive font-medium"
              >
                {form.formState.errors.email.message}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Password Input Field */}
        <motion.div variants={itemVariants} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative group">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••••"
              {...form.register("password")}
              className="h-11 pr-11 transition-all duration-200 border-border/80 bg-background/80 focus-visible:border-primary/70 focus-visible:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Mask input" : "Reveal input"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground/70 hover:text-foreground transition-colors"
            >
              <motion.div whileTap={{ scale: 0.85 }}>
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </motion.div>
            </button>
          </div>
          <AnimatePresence>
            {form.formState.errors.password && (
              <motion.p
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                role="alert"
                className="text-xs text-destructive font-medium"
              >
                {form.formState.errors.password.message}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Submit Button with Animated Shimmer Sweep */}
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.012 }}
          whileTap={{ scale: 0.985 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Button
            type="submit"
            className="relative overflow-hidden w-full gap-2 shadow-lg shadow-primary/20 text-sm font-semibold h-11 bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-300"
            disabled={pending}
          >
            {/* Continuous Shimmer Light Beam */}
            <motion.div
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ translateX: ["-100%", "200%"] }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 1.2,
              }}
            />

            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin text-primary-foreground" />
                <span>Authenticating with Atelier…</span>
              </>
            ) : (
              <span className="flex items-center gap-2">
                <span>Sign In to Your Account</span>
                <ArrowRight className="size-4 opacity-80" />
              </span>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Elegant Animated Divider */}
      <motion.div variants={itemVariants} className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/80" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-semibold">
          <span className="bg-card px-3 text-muted-foreground">Or verify via</span>
        </div>
      </motion.div>

      {/* Google Sign In */}
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <GoogleSignInButton callbackURL={redirectTo} />
      </motion.div>

      {/* Prominent VIP Account Creation Invitation Card */}
      <motion.div
        variants={itemVariants}
        whileHover={{
          scale: 1.015,
          borderColor: "rgba(138, 102, 28, 0.4)",
        }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/[0.06] to-transparent p-5 text-center shadow-xs"
      >
        <div className="flex items-center justify-center gap-1.5 text-primary mb-1">
          <Sparkles className="size-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-widest">
            Private Client Circle
          </span>
        </div>
        <p className="text-xs text-foreground font-medium">
          New to the NEXORA collection?
        </p>
        <div className="mt-2.5">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full h-9 border-primary/40 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
          >
            <Link href="/register" className="flex items-center justify-center gap-1.5">
              <span>Create Complimentary Account</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/80 mt-2">
          Includes certified digital certificates, order provenance & priority dispatch.
        </p>
      </motion.div>
    </motion.div>
  );
}
