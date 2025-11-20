import { LibertyPayClient } from '../src/index';

async function main() {
  const client = new LibertyPayClient({
    baseUrl: process.env.BACKEND_URL || 'http://localhost:3001/api',
    apiKey: 'test-api-key',
  });

  try {
    console.log('1. Creating payment intent...');
    const intent = await client.createPaymentIntent({
      merchantId: '00000000-0000-0000-0000-000000000001',
      amount: '100.00', // Merchant wants $100
      currency: 'USD',
      payoutAsset: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on Mainnet
      payoutChain: 'ethereum',
    });

    console.log('Payment Intent Created:', intent.id);
    console.log(`Pay URL: http://localhost:3000/pay/${intent.id}`);
    
    // Simulate User selecting EVM payment (ETH -> USDC)
    console.log('\n2. Getting EVM Quote (ETH -> USDC)...');
    // Assuming user wants to pay 0.1 ETH
    const quoteRes = await client.quoteEvm({
      paymentIntentId: intent.id,
      chainId: 1, // Ethereum Mainnet
      fromTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
      fromTokenDecimals: 18,
      amountDecimal: '0.1',
    });

    console.log('Quote received:');
    console.log(`  Input: 0.1 ETH`);
    console.log(`  Output (Merchant receives): ${BigInt(quoteRes.quote.dstAmount) / BigInt(1e6)} USDC`);

    console.log('\n3. Building Swap Tx...');
    const tx = await client.buildEvmSwapTx({
      paymentIntentId: intent.id,
      chainId: 1,
      fromTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      userAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', // Random address
      slippageBps: 100, // 1%
    });

    console.log('Transaction ready to sign:');
    console.log('  To:', tx.to);
    console.log('  Value:', tx.value);
    console.log('  Data Length:', tx.data.length);

    // Note: We can't sign/send tx here without a private key, 
    // but in a real app the frontend/wallet handles it.

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main();

