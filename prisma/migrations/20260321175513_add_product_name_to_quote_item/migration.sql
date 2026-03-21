/*
  Warnings:

  - Added the required column `productName` to the `QuoteItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "productName" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "DailyClose" (
    "id" TEXT NOT NULL,
    "closeDate" DATE NOT NULL,
    "totalBilled" DECIMAL(65,30) NOT NULL,
    "totalCollected" DECIMAL(65,30) NOT NULL,
    "cashCollected" DECIMAL(65,30) NOT NULL,
    "otherCollected" DECIMAL(65,30) NOT NULL,
    "totalExpenses" DECIMAL(65,30) NOT NULL,
    "netCashInDrawer" DECIMAL(65,30) NOT NULL,
    "billBreakdownRD" JSONB,
    "billBreakdownUSD" JSONB,
    "billBreakdownEUR" JSONB,
    "totalRD" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalUSD" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalEUR" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discrepancy" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "invoicesData" JSONB,
    "expensesData" JSONB,
    "closedBy" TEXT NOT NULL,
    "closedByName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyClose_closeDate_idx" ON "DailyClose"("closeDate");
