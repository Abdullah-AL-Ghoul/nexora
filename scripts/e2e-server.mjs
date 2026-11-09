/**
 * E2E dev server with deterministic warm-up.
 *
 * Why this exists: under Playwright, `next dev` reports "Ready" as soon as the
 * port opens, but Turbopack still compiles every route on first request. On a
 * cold Windows machine that first compile can take longer than a test's
 * timeout, so the first tests to touch a route time out through no fault of
 * the application. This wrapper spawns the dev server, requests every route
 * the E2E suite visits until each one compiles, and only then stays in the
 * foreground — Playwright's `url` readiness check therefore only passes once
 * all routes are warm.
 *
 * Playwright sends SIGTERM/SIGINT to this process on teardown; we forward it
 * to the dev server so no orphan process keeps port 3100.
 */

import { spawn } from "node:child_process";

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;

const childEnv = {
  ...process.env,
  NEXT_PUBLIC_APP_URL: BASE,
  BETTER_AUTH_URL: BASE,
  NEXORA_MOCK_PAY: "1",
};

const server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
  shell: true,
  env: childEnv,
  stdio: "inherit",
});

server.on("exit", (code) => {
  console.error(`[e2e-server] dev server exited with code ${code}`);
  process.exit(1);
});

/** Every route the E2E suite visits (admin URLs compile as 307 for guests). */
const ROUTES = [
  "/login",
  "/",
  "/shop",
  "/product/aurora-smart-lamp",
  "/product/classic-leather-sneakers",
  "/categories",
  "/category/audio",
  "/search",
  "/cart",
  "/checkout",
  "/wishlist",
  "/account/orders",
  "/admin",
  "/admin/products",
  "/admin/orders",
  "/shipping",
  "/terms",
  "/privacy",
  "/forgot-password",
];

const pending = new Set(ROUTES);
const COMPILE_GRACE_MS = 15 * 60_000; // generous cold-start budget
const startedAt = Date.now();
let stopping = false;

async function probe(route) {
  try {
    // Any HTTP response (200/307/404…) proves the route compiled.
    await fetch(`${BASE}${route}`, { redirect: "manual" });
    return true;
  } catch {
    // Name-resolution/socket failures while compiling are expected.
    return false;
  }
}

async function warmUp() {
  while (pending.size > 0 && !stopping) {
    for (const route of [...pending]) {
      if (await probe(route)) {
        pending.delete(route);
        console.log(`[e2e-server] warm: ${route} (${pending.size} left)`);
      }
    }
    if (pending.size === 0) break;
    if (Date.now() - startedAt > COMPILE_GRACE_MS) {
      console.error(
        `[e2e-server] warm-up budget exhausted, unfinished: ${[...pending].join(", ")}`
      );
      server.kill("SIGTERM");
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  console.log("[e2e-server] all routes warm — suite may start");
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("[e2e-server] shutting down dev server");
  server.kill("SIGTERM");
  setTimeout(() => process.exit(0), 2_000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await warmUp();
// Hold the foreground so Playwright's webServer stays attached.
setInterval(() => {}, 60_000);
