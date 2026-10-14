import { z } from "zod";

/**
 * Environment validation.
 *
 * - `getPublicEnv()` is safe to call from client and server code
 *   (only NEXT_PUBLIC_* variables).
 * - `getServerEnv()` must ONLY be called from server code
 *   (route handlers, server actions, server components).
 *
 * Secrets are never printed — only field names are reported on failure.
 */

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default(""),
});

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 chars"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
});

type ClientEnv = z.infer<typeof clientEnvSchema>;
type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseEnv<T>(
  schema: z.ZodType<T>,
  source: Record<string, string | undefined>,
  label: string
): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "(root)"))),
    ];
    throw new Error(`Invalid ${label} environment variables: ${fields.join(", ")}`);
  }
  return result.data;
}

export function getPublicEnv(): ClientEnv {
  return parseEnv(clientEnvSchema, process.env, "public");
}

export function getServerEnv(): ServerEnv {
  return parseEnv(serverEnvSchema, process.env, "server");
}
