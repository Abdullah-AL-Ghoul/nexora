import { NextResponse } from "next/server";
import { z } from "zod";

import { updateConsultationStatus } from "@/lib/consultations";
import { requireApiRole } from "@/lib/auth/api-guards";
import { STAFF_ROLES } from "@/lib/auth/guards";

const statusSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "CLOSED"]),
});

/**
 * PATCH /api/admin/consultations/[id] — staff status transition
 * (Manager + Admin), mirroring the order state machine semantics.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireApiRole(STAFF_ROLES);
  if ("error" in gate) return gate.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const result = await updateConsultationStatus(id, parsed.data.status);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
