import { NextResponse } from "next/server";

import { quoteCartItems } from "@/lib/cart/quote";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { quoteRequestSchema } from "@/lib/validators/cart";

/**
 * POST /api/cart/quote — server-side pricing authority.
 * Rejects malformed/spoofed payloads (strict zod) and returns fresh
 * prices, stock, line totals, and rejected (stale) lines.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`quote:${clientIp(request)}`, 60, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid cart payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const quote = await quoteCartItems(parsed.data.items);
    return NextResponse.json(quote);
  } catch {
    return NextResponse.json({ error: "Unable to quote cart." }, { status: 500 });
  }
}
