import "dotenv/config";
import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { Pool } from "pg";

type E2EFixtures = {
  qrToken: string;
};

export const test = base.extend<E2EFixtures>({
  qrToken: async ({}, fixtureUse) => {
    const connectionString = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error("E2E_DATABASE_URL or DATABASE_URL is required for E2E fixtures");

    const pool = new Pool({ connectionString, max: 1 });
    try {
      const result = await pool.query<{ qrToken: string }>(
        'SELECT "qrToken" FROM "DiningTable" WHERE "active" = true ORDER BY "label" ASC LIMIT 1',
      );
      const token = result.rows[0]?.qrToken;
      if (!token) throw new Error("No active dining table is available for E2E tests");
      await fixtureUse(token);
    } finally {
      await pool.end();
    }
  },
});

export function collectBrowserErrors(page: Page): string[] {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("Download the React DevTools")) browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  return browserErrors;
}

export { expect };
