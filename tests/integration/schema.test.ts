import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const connectionString = process.env.TEST_DATABASE_URL;

if (!connectionString) {
  throw new Error("TEST_DATABASE_URL is required for integration tests");
}

const pool = new Pool({ connectionString });
const createdTableIds: string[] = [];
const createdWindowIds: string[] = [];

afterAll(async () => {
  if (createdTableIds.length > 0) {
    await pool.query('DELETE FROM "Order" WHERE "tableId" = ANY($1::text[])', [createdTableIds]);
    await pool.query('DELETE FROM "CustomerSession" WHERE "tableId" = ANY($1::text[])', [createdTableIds]);
    await pool.query('DELETE FROM "DiningTable" WHERE id = ANY($1::text[])', [createdTableIds]);
  }
  if (createdWindowIds.length > 0) {
    await pool.query('DELETE FROM "ServiceWindow" WHERE id = ANY($1::text[])', [createdWindowIds]);
  }
  await pool.end();
});

describe("initial relational schema", () => {
  it("keeps simultaneous table orders attached to their own customer sessions", async () => {
    const tableId = randomUUID();
    const firstSessionId = randomUUID();
    const secondSessionId = randomUUID();
    const now = new Date();
    createdTableIds.push(tableId);

    await pool.query(
      'INSERT INTO "DiningTable" (id, label, "qrToken", "updatedAt") VALUES ($1, $2, $3, $4)',
      [tableId, `Schema test ${tableId}`, randomUUID(), now],
    );
    await pool.query(
      'INSERT INTO "CustomerSession" (id, "tableId", nickname, "tokenHash", "expiresAt") VALUES ($1, $2, $3, $4, $5), ($6, $2, $7, $8, $9)',
      [
        firstSessionId,
        tableId,
        "Primera persona",
        randomUUID(),
        new Date(Date.now() + 60_000),
        secondSessionId,
        "Segunda persona",
        randomUUID(),
        new Date(Date.now() + 60_000),
      ],
    );

    await pool.query(
      'INSERT INTO "Order" (id, "clientRequestId", "tableId", "customerSessionId", origin, "totalCents", "updatedAt") VALUES ($1, $2, $3, $4, \'QR\', 12500, $5), ($6, $7, $3, $8, \'QR\', 8000, $5)',
      [randomUUID(), randomUUID(), tableId, firstSessionId, now, randomUUID(), randomUUID(), secondSessionId],
    );

    const result = await pool.query(
      'SELECT "customerSessionId" FROM "Order" WHERE "tableId" = $1 ORDER BY "totalCents"',
      [tableId],
    );

    expect(result.rows.map((row: { customerSessionId: string }) => row.customerSessionId)).toEqual([
      secondSessionId,
      firstSessionId,
    ]);
  });

  it("rejects two service windows for the same weekday", async () => {
    const weekday = Math.floor(Math.random() * 7) + 1;
    const firstId = randomUUID();
    const secondId = randomUUID();
    createdWindowIds.push(firstId, secondId);

    await pool.query(
      'INSERT INTO "ServiceWindow" (id, weekday, "opensAtMinute", "closesAtMinute") VALUES ($1, $2, 600, 1200)',
      [firstId, weekday],
    );

    await expect(
      pool.query(
        'INSERT INTO "ServiceWindow" (id, weekday, "opensAtMinute", "closesAtMinute") VALUES ($1, $2, 660, 1260)',
        [secondId, weekday],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
});
