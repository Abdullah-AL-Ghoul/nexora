import "dotenv/config";
import { prisma } from "../lib/db";

/**
 * Removes consultation rows created by the integration test suite
 * (e2e-consult-* emails), mirroring scripts/clean-test-orders.ts.
 */
export async function cleanConsultationTests(): Promise<void> {
  const rows = await prisma.consultationRequest.findMany({
    where: { email: { contains: "e2e-consult" } },
    select: { id: true },
  });
  for (const row of rows) {
    await prisma.consultationRequest.delete({ where: { id: row.id } }).catch(() => undefined);
  }
  console.log(`cleaned ${rows.length} test consultation rows`);
  await prisma.$disconnect();
}

if (process.argv[1]?.includes("clean-consultation-tests")) {
  cleanConsultationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Cleanup error:", err);
      process.exit(1);
    });
}
