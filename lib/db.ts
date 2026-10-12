import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { getServerEnv } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const env = getServerEnv();
  const isLocal = env.DATABASE_URL.includes("localhost") || env.DATABASE_URL.includes("127.0.0.1");
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

