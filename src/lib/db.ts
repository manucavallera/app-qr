import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { getServerEnv } from "./env";

type PrismaGlobal = typeof globalThis & {
  appQrPool?: Pool;
  appQrPrisma?: PrismaClient;
};

const globalForPrisma = globalThis as PrismaGlobal;

const pool =
  globalForPrisma.appQrPool ??
  new Pool({
    connectionString: getServerEnv().DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.appQrPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.appQrPool = pool;
  globalForPrisma.appQrPrisma = prisma;
}
