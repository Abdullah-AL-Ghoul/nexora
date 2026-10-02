import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";

/**
 * NEXORA auth server instance (better-auth + Prisma adapter).
 *
 * - Secret/base URL are read from BETTER_AUTH_SECRET / BETTER_AUTH_URL.
 * - `role` is an additional field backed by the Prisma `Role` enum.
 *   `input: false` prevents clients from self-assigning roles at signup —
 *   roles are granted server-side only.
 * - Dev mode: reset/verification emails are logged to the server console
 *   (no email provider in the local environment).
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
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
    },
  },
});

export type Auth = typeof auth;
export type Session = Awaited<ReturnType<Auth["api"]["getSession"]>>;
