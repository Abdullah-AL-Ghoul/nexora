import { NextResponse } from "next/server";

import { createConsultation, consultationSchema } from "@/lib/consultations";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/consultations — records a "Private Consultation" request.
 * Public endpoint: per-IP throttle of 3 requests / 5 minutes.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`consultations:${clientIp(request)}`, 3, 5 * 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = consultationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please review the highlighted fields.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const result = await createConsultation(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
