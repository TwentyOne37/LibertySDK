-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'AWAITING_DEPOSIT', 'SWAPPING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentIntentMode" AS ENUM ('CHEAPEST', 'PRIVACY', 'MANUAL');

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payoutAsset" TEXT NOT NULL,
    "payoutChain" TEXT NOT NULL,
    "payoutAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "payoutAsset" TEXT NOT NULL,
    "payoutChain" TEXT NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
    "mode" "PaymentIntentMode" NOT NULL,
    "provider" TEXT,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
