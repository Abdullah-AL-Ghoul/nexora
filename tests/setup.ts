import { vi } from "vitest";

// Integration tests import server modules that call revalidateTag inside
// mutations; outside the Next runtime this API is unavailable, so it is
// stubbed. Invalidation itself is verified end-to-end against the server.
vi.mock("next/cache", () => ({
  revalidateTag: () => undefined,
  unstable_cache: (fn: unknown) => fn,
  updateTag: () => undefined,
  revalidatePath: () => undefined,
}));
