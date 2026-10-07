-- AlterTable
ALTER TABLE "Product" ADD COLUMN "extraImageKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
