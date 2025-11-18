-- AlterTable
ALTER TABLE "payment_intents" ADD COLUMN     "intentsDepositAddress" TEXT,
ADD COLUMN     "intentsDestinationAssetId" TEXT,
ADD COLUMN     "intentsOriginAssetId" TEXT,
ADD COLUMN     "intentsRawQuote" JSONB,
ADD COLUMN     "intentsStatus" TEXT,
ADD COLUMN     "intentsSwapType" TEXT;
