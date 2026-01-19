-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "closingId" TEXT;

-- CreateTable
CREATE TABLE "PettyCashClosing" (
    "id" TEXT NOT NULL,
    "openingBalance" DECIMAL(65,30) NOT NULL,
    "totalIncome" DECIMAL(65,30) NOT NULL,
    "totalExpense" DECIMAL(65,30) NOT NULL,
    "closingBalance" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT NOT NULL,
    "closedByName" TEXT NOT NULL,

    CONSTRAINT "PettyCashClosing_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "PettyCashClosing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
