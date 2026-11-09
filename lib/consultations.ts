import { prisma } from "@/lib/db";
export * from "./consultations-constants";
import type {
  ConsultationInput,
  ConsultationStatusValue,
} from "./consultations-constants";
import { CONSULTATION_TRANSITIONS } from "./consultations-constants";

export type CreateConsultationResult =
  | { ok: true; id: string; deduped: boolean }
  | { ok: false; error: string };

export async function createConsultation(
  rawInput: ConsultationInput
): Promise<CreateConsultationResult> {
  // Normalize here — clients and tests may pass unnormalized values.
  const input: ConsultationInput = {
    ...rawInput,
    fullName: rawInput.fullName.trim(),
    email: rawInput.email.trim().toLowerCase(),
    phone: rawInput.phone.trim(),
    notes: rawInput.notes?.trim() ?? "",
    productName: rawInput.productName?.trim() ?? "",
    productSlug: rawInput.productSlug?.trim() ?? "",
  };
  const preferredDate = input.preferredDate ? new Date(`${input.preferredDate}T00:00:00Z`) : null;

  try {
    // Dedupe within 24h: same email AND same product/topic → update the note.
    const recent = await prisma.consultationRequest.findFirst({
      where: {
        email: input.email,
        type: input.type,
        productName: input.productName ? input.productName : null,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (recent) {
      const updated = await prisma.consultationRequest.update({
        where: { id: recent.id },
        data: {
          fullName: input.fullName,
          phone: input.phone,
          preferredDate,
          notes: input.notes || null,
        },
        select: { id: true },
      });
      return { ok: true, id: updated.id, deduped: true };
    }

    const created = await prisma.consultationRequest.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        type: input.type,
        preferredDate,
        notes: input.notes || null,
        productName: input.productName || null,
        productSlug: input.productSlug || null,
      },
      select: { id: true },
    });
    return { ok: true, id: created.id, deduped: false };
  } catch {
    return { ok: false, error: "Unable to record your consultation request right now." };
  }
}

export type UpdateConsultationStatusResult =
  | { ok: true }
  | { ok: false; status: 404 | 409 | 500; error: string };

export async function updateConsultationStatus(
  id: string,
  target: ConsultationStatusValue
): Promise<UpdateConsultationStatusResult> {
  try {
    const existing = await prisma.consultationRequest.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) return { ok: false, status: 404, error: "Consultation request not found." };

    if (!(CONSULTATION_TRANSITIONS[existing.status] ?? []).includes(target)) {
      return {
        ok: false,
        status: 409,
        error: `Cannot move request from ${existing.status} to ${target}.`,
      };
    }

    await prisma.consultationRequest.update({
      where: { id },
      data: { status: target },
      select: { id: true },
    });
    return { ok: true };
  } catch {
    return { ok: false, status: 500, error: "Unable to update the consultation request." };
  }
}
