-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'ON_TAB';

-- AlterTable
ALTER TABLE "DiningTable" ADD COLUMN     "billRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PaymentSettings" ADD COLUMN     "tabEnabled" BOOLEAN NOT NULL DEFAULT false;
