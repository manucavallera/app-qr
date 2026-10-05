/*
  Warnings:

  - You are about to drop the column `billRequestedAt` on the `DiningTable` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "tabId" TEXT;

-- CreateTable
CREATE TABLE "TableTab" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "tableId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billRequestedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "TableTab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TableTab_number_key" ON "TableTab"("number");

-- CreateIndex
CREATE INDEX "TableTab_tableId_closedAt_idx" ON "TableTab"("tableId", "closedAt");

-- CreateIndex
CREATE INDEX "Order_tabId_idx" ON "Order"("tabId");

-- AddForeignKey
ALTER TABLE "TableTab" ADD CONSTRAINT "TableTab_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "TableTab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pasa a una cuenta real los pedidos "pagar al final" que sigan sin cobrar, antes de borrar la columna vieja.
INSERT INTO "TableTab" ("id", "tableId", "openedAt", "billRequestedAt")
SELECT gen_random_uuid()::text, t."id", MIN(o."createdAt"), t."billRequestedAt"
FROM "DiningTable" t
JOIN "Order" o ON o."tableId" = t."id" AND o."status" <> 'CANCELLED'
JOIN "PaymentAttempt" p ON p."orderId" = o."id" AND p."method" = 'ON_TAB' AND p."status" = 'UNPAID'
GROUP BY t."id", t."billRequestedAt";

UPDATE "Order" o SET "tabId" = tab."id"
FROM "TableTab" tab
WHERE tab."tableId" = o."tableId" AND tab."closedAt" IS NULL AND o."status" <> 'CANCELLED'
  AND EXISTS (SELECT 1 FROM "PaymentAttempt" p WHERE p."orderId" = o."id" AND p."method" = 'ON_TAB' AND p."status" = 'UNPAID');

-- AlterTable
ALTER TABLE "DiningTable" DROP COLUMN "billRequestedAt";
