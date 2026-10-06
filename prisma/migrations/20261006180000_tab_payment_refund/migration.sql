-- AlterTable
ALTER TABLE "TabPayment" ADD COLUMN     "refundDueCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundedAt" TIMESTAMP(3);
