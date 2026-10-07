import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/newsletter — real subscription capture (deduped by unique email).
 * Throttled to prevent abuse of the public endpoint.
 */
const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
});

export async function POST(request: Request) {
  const limit = rateLimit(`newsletter:${clientIp(request)}`, 5, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  try {
    // Idempotent: a repeat subscription is a success, not an error.
    await prisma.newsletterSubscriber.upsert({
      where: { email: parsed.data.email },
      update: {},
      create: { email: parsed.data.email },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to subscribe right now." }, { status: 500 });
  }
}
