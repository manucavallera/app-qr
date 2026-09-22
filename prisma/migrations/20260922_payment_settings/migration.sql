-- Add the explicit manual bank-transfer payment method.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';

-- Keep payment configuration separate from schedules and operating mode.
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "mercadoPagoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cashEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cardAtCounterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bankTransferEnabled" BOOLEAN NOT NULL DEFAULT false,
    "bankAlias" TEXT,
    "bankCbuCvu" TEXT,
    "bankAccountHolder" TEXT,
    "bankInstructions" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);
