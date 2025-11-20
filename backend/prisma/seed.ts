import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Default Test Merchant (USDC on Ethereum)
  const merchantEth = await prisma.merchant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Liberty Store (ETH)',
      payoutAsset: 'USDC',
      payoutChain: 'ETHEREUM',
      payoutAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // vitalik.eth (Example)
    },
  });

  // 2. Secondary Merchant (USDC on Polygon) - For future extensibility checks
  const merchantPoly = await prisma.merchant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Liberty Store (Polygon)',
      payoutAsset: 'USDC',
      payoutChain: 'POLYGON',
      payoutAddress: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', // Binance Hot Wallet (Example)
    },
  });

  console.log('Seeded merchants:', { merchantEth, merchantPoly });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
