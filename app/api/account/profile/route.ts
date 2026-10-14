import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/guards";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  phone: z.string().trim().max(32).optional().nullable(),
});

export async function PATCH(request: Request) {
  const limit = rateLimit(`account-profile:${clientIp(request)}`, 20, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSeconds);

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid profile data" },
        { status: 400 }
      );
    }

    const { name, phone } = parsed.data;

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        phone: phone?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
