import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { getPublicEnv } from "@/lib/env";

/**
 * NEXORA auth server instance (better-auth + Prisma adapter).
 *
 * - Secret/base URL are read from BETTER_AUTH_SECRET / BETTER_AUTH_URL.
 * - `role` is an additional field backed by the Prisma `Role` enum.
 *   `input: false` prevents clients from self-assigning roles at signup —
 *   roles are granted server-side only.
 * - Disabled accounts (`isActive = false`, set from /admin/users) are
 *   rejected at sign-in.
 * - Rate limiting is always on: credential endpoints get a stricter quota
 *   than the generic auth routes.
 * - Dev mode: reset/verification emails are logged to the server console
 *   (no email provider in the local environment).
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [
    new URL(getPublicEnv().NEXT_PUBLIC_APP_URL).origin,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://localhost:3100",
    "http://127.0.0.1:3100",
  ],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "memory",
    specialRules: [
      { pathMatcher: "/sign-in/email", window: 60, max: 10 },
      { pathMatcher: "/sign-up/email", window: 60, max: 10 },
      { pathMatcher: "/forget-password", window: 60, max: 5 },
    ],
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email =
        typeof (ctx.body as { email?: unknown } | undefined)?.email === "string"
          ? ((ctx.body as { email: string }).email)
          : null;
      if (!email) return;

      const user = (await ctx.context.adapter.findOne({
        model: "user",
        where: [{ field: "email", value: email }],
      })) as { isActive?: boolean } | null;

      if (user && user.isActive === false) {
        throw new APIError("FORBIDDEN", {
          message: "This account has been disabled.",
        });
      }
    }),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      console.log(`[auth] Password reset link for ${user.email}: ${url}`);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`[auth] Email verification link for ${user.email}: ${url}`);
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "CUSTOMER",
        required: false,
        input: false,
      },
      phone: {
        type: "string",
        required: false,
        input: true,
      },
      // Must be registered here: better-auth's adapter only selects fields
      // known to its schema, and the sign-in hook below needs to read it.
      // `input: false` — only /admin/users may flip this flag.
      isActive: {
        type: "boolean",
        defaultValue: true,
        required: false,
        input: false,
      },
    },
  },
});

export type Auth = typeof auth;
export type Session = Awaited<ReturnType<Auth["api"]["getSession"]>>;
