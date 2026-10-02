import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Server-side authorization helpers.
 *
 * PERMISSION RULE (M20): checks MUST happen on the server.
 * Hiding navigation links is NOT authorization — every protected page
 * or action calls one of these helpers.
 */

export type AppRole = "CUSTOMER" | "MANAGER" | "ADMIN";

/** Sections a Manager may access (Admin gets everything). */
export const STAFF_ROLES: readonly AppRole[] = ["ADMIN", "MANAGER"];
/** Sections restricted to Admin only. */
export const ADMIN_ROLES: readonly AppRole[] = ["ADMIN"];

export function isAppRole(value: unknown): value is AppRole {
  return value === "CUSTOMER" || value === "MANAGER" || value === "ADMIN";
}

export function roleAllowed(role: unknown, allowed: readonly AppRole[]): boolean {
  return isAppRole(role) && allowed.includes(role);
}

/** Returns the current session or `null` (never throws). */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Requires a signed-in user; redirects otherwise. */
export async function requireSession(redirectTo = "/login") {
  const session = await getSession();
  if (!session) redirect(redirectTo);
  return session;
}

/**
 * Requires a signed-in user whose role is in `allowed`.
 * - No session → `redirectTo` (defaults to /login).
 * - Signed in but wrong role → `/account` (authenticated, but not permitted).
 */
export async function requireRole(allowed: readonly AppRole[], redirectTo = "/login") {
  const session = await requireSession(redirectTo);
  if (!roleAllowed(session.user.role, allowed)) redirect("/account");
  return session;
}
