'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPaymentIntent } from '@/lib/api';

export default function CreateIntentPage() {
  const router = useRouter();
  const [amount, setAmount] = useState('10.00');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await createPaymentIntent({
        merchantId: '00000000-0000-0000-0000-000000000001',
        amount,
        currency,
        payoutAsset: 'USDC',
        payoutChain: 'ethereum',
        mode: 'CHEAPEST',
      });

      router.push(`/pay/${result.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-md max-w-sm w-full">
        <h1 className="text-xl font-bold mb-6 text-gray-800">Create Test Payment</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
              placeholder="10.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Payment Link'}
          </button>
        </form>
      </div>
    </div>
  );
}

