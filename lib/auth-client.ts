import { createAuthClient } from "better-auth/react";

/**
 * Client-side better-auth instance (same origin as the server).
 * Session data returned here is UNTRUSTED for authorization decisions —
 * always re-check roles server-side via `lib/auth/guards.ts`.
 */
export const authClient = createAuthClient();
