-- CreateTable
CREATE TABLE "TabPayment" (
    "id" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "customerSessionId" TEXT,
    "orderIds" TEXT[],
    "amountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "checkoutUrl" TEXT,
    "providerPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TabPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TabPayment_idempotencyKey_key" ON "TabPayment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "TabPayment_providerOrderId_key" ON "TabPayment"("providerOrderId");

-- CreateIndex
CREATE INDEX "TabPayment_tabId_status_idx" ON "TabPayment"("tabId", "status");

-- AddForeignKey
ALTER TABLE "TabPayment" ADD CONSTRAINT "TabPayment_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "TableTab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
