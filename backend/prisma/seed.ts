import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a default merchant for testing
  const merchant = await prisma.merchant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Test Merchant',
      payoutAsset: 'USDC',
      payoutChain: 'ethereum',
      payoutAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    },
  });

  console.log('Seeded merchant:', merchant);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

