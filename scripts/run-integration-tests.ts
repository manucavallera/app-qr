import "dotenv/config";
import { spawnSync } from "node:child_process";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  console.error("TEST_DATABASE_URL is required. Copy .env.example to .env first.");
  process.exit(1);
}

const npmExec = process.platform === "win32" ? "npx.cmd" : "npx";
const childEnvironment = { ...process.env, DATABASE_URL: testDatabaseUrl };

const migration = spawnSync(npmExec, ["prisma", "migrate", "deploy"], {
  env: childEnvironment,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (migration.error) {
  console.error("Could not run Prisma migrations:", migration.error.message);
  process.exit(migration.status ?? 1);
}
if (migration.status !== 0) {
  process.exit(migration.status ?? 1);
}

const testRun = spawnSync(
  npmExec,
  ["vitest", "run", "--config", "vitest.integration.config.ts", ...process.argv.slice(2)],
  {
    env: childEnvironment,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

if (testRun.error) {
  console.error("Could not run integration tests:", testRun.error.message);
  process.exit(testRun.status ?? 1);
}
process.exit(testRun.status ?? 1);
