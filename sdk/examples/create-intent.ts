import { ZypherpayClient } from '../src/index';

async function main() {
  const client = new ZypherpayClient({
    baseUrl: process.env.BACKEND_URL || 'http://localhost:3001/api',
    apiKey: 'test-api-key',
  });

  try {
    console.log('Creating payment intent...');
    const intent = await client.createPaymentIntent({
      merchantId: '00000000-0000-0000-0000-000000000001',
      amount: '50.00',
      currency: 'USD',
      payoutAsset: 'USDC',
      payoutChain: 'ethereum',
      mode: 'cheapest',
    });

    console.log('Payment Intent Created!');
    console.log('ID:', intent.id);
    console.log('Status:', intent.status);
    console.log('---------------------------------------------------');
    console.log(`Pay URL: http://localhost:3000/pay/${intent.id}`);
    console.log('---------------------------------------------------');

  } catch (error: any) {
    console.error('Error creating payment intent:', error.message);
  }
}

main();

