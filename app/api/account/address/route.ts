import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/guards";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const addressPayloadSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().max(40).default("Default Shipping"),
  fullName: z.string().trim().min(2, "Full name is required").max(80),
  line1: z.string().trim().min(3, "Street address is required").max(120),
  line2: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(1, "City is required").max(60),
  region: z.string().trim().max(60).optional().nullable(),
  postalCode: z.string().trim().min(3, "Postal code is required").max(16),
  country: z.string().trim().min(2, "Country is required").max(56),
  phone: z.string().trim().max(32).optional().nullable(),
  isDefault: z.boolean().default(true),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ addresses });
}

export async function POST(request: Request) {
  const limit = rateLimit(`account-address:${clientIp(request)}`, 20, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSeconds);

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = addressPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid address payload" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // If setting as default, clear any existing default flag for other addresses
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: session.user.id },
        data: { isDefault: false },
      });
    }

    let address;
    if (data.id) {
      // Update existing address
      address = await prisma.address.update({
        where: { id: data.id, userId: session.user.id },
        data: {
          label: data.label,
          fullName: data.fullName,
          line1: data.line1,
          line2: data.line2?.trim() || null,
          city: data.city,
          region: data.region?.trim() || null,
          postalCode: data.postalCode,
          country: data.country,
          phone: data.phone?.trim() || null,
          isDefault: data.isDefault,
        },
      });
    } else {
      // Check if user has an address already
      const existing = await prisma.address.findFirst({
        where: { userId: session.user.id },
      });

      if (existing) {
        address = await prisma.address.update({
          where: { id: existing.id },
          data: {
            label: data.label,
            fullName: data.fullName,
            line1: data.line1,
            line2: data.line2?.trim() || null,
            city: data.city,
            region: data.region?.trim() || null,
            postalCode: data.postalCode,
            country: data.country,
            phone: data.phone?.trim() || null,
            isDefault: true,
          },
        });
      } else {
        address = await prisma.address.create({
          data: {
            userId: session.user.id,
            label: data.label,
            fullName: data.fullName,
            line1: data.line1,
            line2: data.line2?.trim() || null,
            city: data.city,
            region: data.region?.trim() || null,
            postalCode: data.postalCode,
            country: data.country,
            phone: data.phone?.trim() || null,
            isDefault: true,
          },
        });
      }
    }

    // Keep user's profile phone in sync if provided
    if (data.phone) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { phone: data.phone.trim() },
      }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, address });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to save address" },
      { status: 500 }
    );
  }
}
