const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:3001/api';

export async function fetchPaymentIntent(id: string) {
  const res = await fetch(`${BACKEND_BASE_URL}/payment-intents/${id}`);
  if (!res.ok) throw new Error('Failed to fetch payment intent');
  return res.json();
}

export async function fetchPaymentStatus(id: string) {
  const res = await fetch(`${BACKEND_BASE_URL}/payment-intents/${id}/status`);
  if (!res.ok) throw new Error('Failed to fetch payment status');
  return res.json();
}

export async function quoteZec(id: string) {
  const res = await fetch(`${BACKEND_BASE_URL}/payment-intents/${id}/quote-zec`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to quote ZEC');
  }
  return res.json();
}

export async function createPaymentIntent(data: any) {
  const res = await fetch(`${BACKEND_BASE_URL}/payment-intents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create payment intent');
  return res.json();
}

