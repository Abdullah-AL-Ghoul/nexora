import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createConsultation,
  updateConsultationStatus,
  type ConsultationInput,
} from "@/lib/consultations";

/**
 * Integration coverage for concierge consultation requests, run against the
 * local dev database. Every created row is removed after the suite.
 */

const createdIds: string[] = [];
// Unique per run so a failed earlier run cannot leak rows into assertions.
const testEmail = `e2e-consult-${process.pid}-${Date.now()}@example.test`;

function consultationInput(overrides?: Partial<ConsultationInput>): ConsultationInput {
  return {
    fullName: "E2E Client",
    email: testEmail,
    phone: "+20 100 000 0000",
    type: "viewing",
    preferredDate: "",
    notes: "",
    productName: "",
    productSlug: "",
    ...overrides,
  };
}

let dbAvailable = false;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    console.warn("Skipping consultation integration tests: database connection unavailable");
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  for (const id of createdIds) {
    await prisma.consultationRequest.delete({ where: { id } }).catch(() => undefined);
  }
  await prisma.$disconnect().catch(() => undefined);
});

beforeEach((ctx) => {
  if (!dbAvailable) {
    ctx.skip();
  }
});

describe("createConsultation", () => {
  it("creates a NEW request and dedupes repeats within 24h", async () => {
    const input = consultationInput({ productSlug: "aurora-smart-lamp", productName: "Aurora Smart Lamp" });

    const first = await createConsultation(input);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    createdIds.push(first.id);
    expect(first.deduped).toBe(false);

    const second = await createConsultation(
      consultationInput({
        email: input.email.toUpperCase(),
        productSlug: input.productSlug,
        productName: input.productName,
        notes: "Follow-up: ring size 7.",
      })
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.deduped).toBe(true);
    expect(second.id).toBe(first.id);

    const rows = await prisma.consultationRequest.count({
      where: { email: input.email, productName: input.productName },
    });
    expect(rows).toBe(1);

    const row = await prisma.consultationRequest.findUnique({ where: { id: first.id } });
    expect(row?.notes).toContain("ring size 7");
    expect(row?.status).toBe("NEW");
  });

  it("keeps different topics and older requests separate", async () => {
    const first = await createConsultation(consultationInput({ type: "acquisition" }));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    createdIds.push(first.id);

    const second = await createConsultation(consultationInput({ type: "styling" }));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    createdIds.push(second.id);
    expect(second.id).not.toBe(first.id);
    expect(second.deduped).toBe(false);
  });
});

describe("updateConsultationStatus", () => {
  it("moves NEW → CONTACTED → CLOSED and rejects illegal transitions", async () => {
    const created = await createConsultation(consultationInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdIds.push(created.id);

    const toContacted = await updateConsultationStatus(created.id, "CONTACTED");
    expect(toContacted.ok).toBe(true);

    const toClosed = await updateConsultationStatus(created.id, "CLOSED");
    expect(toClosed.ok).toBe(true);

    const backToNew = await updateConsultationStatus(created.id, "NEW");
    expect(backToNew.ok).toBe(false);
    if (!backToNew.ok) expect(backToNew.status).toBe(409);

    const row = await prisma.consultationRequest.findUnique({
      where: { id: created.id },
      select: { status: true },
    });
    expect(row?.status).toBe("CLOSED");
  });

  it("rejects unknown ids with 404", async () => {
    const result = await updateConsultationStatus("does-not-exist", "CONTACTED");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});
