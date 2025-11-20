-- AlterTable
ALTER TABLE "payment_intents" ADD COLUMN     "oneInchChainId" INTEGER,
ADD COLUMN     "oneInchFromToken" TEXT,
ADD COLUMN     "oneInchQuote" JSONB,
ADD COLUMN     "oneInchStatus" TEXT,
ADD COLUMN     "oneInchToToken" TEXT,
ADD COLUMN     "oneInchTxHash" TEXT;
