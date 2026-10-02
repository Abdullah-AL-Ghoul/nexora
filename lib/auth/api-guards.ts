import { NextResponse } from "next/server";

import { getSession, roleAllowed, type AppRole } from "@/lib/auth/guards";

/**
 * JSON guards for admin API routes (pages use requireRole and redirect;
 * API routes must answer with 401/403 instead of HTML redirects).
 */
export async function requireApiRole(allowed: readonly AppRole[]) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  if (!roleAllowed(session.user.role, allowed)) {
    return { error: NextResponse.json({ error: "Not permitted." }, { status: 403 }) };
  }
  return { session };
}
