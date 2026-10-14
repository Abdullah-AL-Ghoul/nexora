"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
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

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: RegisterInput) {
    setPending(true);
    const { error } = await authClient.signUp.email(values);
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Unable to create account");
      return;
    }
    toast.success("Welcome to NEXORA Atelier! Your account has been registered.");
    router.push("/shop");
    router.refresh();
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Full Name
          </Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Jane Doe"
            {...form.register("name")}
            className="h-11 transition-all duration-200 border-border/80 bg-background/80 focus-visible:border-primary/70 focus-visible:ring-primary/20"
          />
          <AnimatePresence>
            {form.formState.errors.name && (
              <motion.p
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                role="alert"
                className="text-xs text-destructive font-medium"
              >
                {form.formState.errors.name.message}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...form.register("email")}
            className="h-11 transition-all duration-200 border-border/80 bg-background/80 focus-visible:border-primary/70 focus-visible:ring-primary/20"
          />
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

        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Password (at least 8 characters)
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            {...form.register("password")}
            className="h-11 transition-all duration-200 border-border/80 bg-background/80 focus-visible:border-primary/70 focus-visible:ring-primary/20"
          />
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
                <span>Creating your account…</span>
              </>
            ) : (
              <span className="flex items-center gap-2">
                <span>Join Atelier Circle</span>
                <ArrowRight className="size-4 opacity-80" />
              </span>
            )}
          </Button>
        </motion.div>
      </form>

      <motion.div variants={itemVariants} className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/80" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-semibold">
          <span className="bg-card px-3 text-muted-foreground">or sign up with</span>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <GoogleSignInButton callbackURL="/shop" />
      </motion.div>

      <motion.p variants={itemVariants} className="text-center text-xs text-muted-foreground pt-2">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
        >
          Sign in
        </Link>
      </motion.p>
    </motion.div>
  );
}
