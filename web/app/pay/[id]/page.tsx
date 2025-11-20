'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { fetchPaymentIntent, fetchPaymentStatus, quoteZec } from '@/lib/api';

interface PaymentState {
  status: string;
  depositAddress?: string;
  expectedAmountInZec?: string;
  merchantName?: string;
  amount: string;
  currency: string;
  payoutAsset: string;
  payoutChain: string;
  error?: string;
}

export default function PaymentPage() {
  const params = useParams();
  const id = params.id as string;

  const [state, setState] = useState<PaymentState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let mounted = true;

    async function init() {
      try {
        // 1. Fetch Intent Details
        const intent = await fetchPaymentIntent(id);
        
        let depositAddress = intent.intentsDepositAddress;
        let expectedAmountInZec = intent.intentsRawQuote?.depositAmount || intent.intentsRawQuote?.amount;

        // 2. If CREATED, trigger Quote
        if (intent.status === 'CREATED') {
          try {
            const quote = await quoteZec(id);
            depositAddress = quote.depositAddress;
            expectedAmountInZec = quote.expectedAmountInZec;
            // update status locally
            intent.status = quote.status;
          } catch (err) {
            console.error('Quote failed', err);
            // If quote fails, we might want to show error or retry
          }
        }

        if (mounted) {
          setState({
            status: intent.status,
            depositAddress,
            expectedAmountInZec,
            merchantName: intent.merchant?.name || 'Merchant',
            amount: intent.amount,
            currency: intent.currency,
            payoutAsset: intent.payoutAsset,
            payoutChain: intent.payoutChain,
          });
          setLoading(false);
        }

        // 3. Poll Status
        if (intent.status !== 'COMPLETED' && intent.status !== 'FAILED') {
          intervalId = setInterval(async () => {
            try {
              const statusData = await fetchPaymentStatus(id);
              if (mounted) {
                setState((prev) => prev ? { ...prev, status: statusData.status } : null);
                
                if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED') {
                  clearInterval(intervalId);
                }
              }
            } catch (e) {
              console.error('Polling error', e);
            }
          }, 5000); // Poll every 5s (requested 10s but 5s feels snappier, sticking to 10s as per requirements? Prompt said 10s)
        }

      } catch (err: any) {
        if (mounted) {
            setState((prev) => prev ? { ...prev, error: err.message } : { 
                status: 'ERROR', 
                amount: '0', 
                currency: '', 
                payoutAsset: '', 
                payoutChain: '',
                error: err.message 
            });
            setLoading(false);
        }
      }
    }

    if (id) {
      init();
    }

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading payment...</div>
      </div>
    );
  }

  if (!state || state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-500">Error: {state?.error || 'Failed to load payment'}</div>
      </div>
    );
  }

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'CREATED':
      case 'AWAITING_DEPOSIT':
        return 'Waiting for your ZEC payment...';
      case 'SWAPPING':
      case 'PENDING_DEPOSIT': // Possible internal status
        return 'Converting via NEAR Intents...';
      case 'COMPLETED':
        return 'Payment complete 🎉';
      case 'FAILED':
        return 'Payment failed. Contact support.';
      default:
        return `Status: ${status}`;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full space-y-6">
        
        {/* Header */}
        <div className="text-center border-b pb-4">
          <h1 className="text-xl font-bold text-gray-800">{state.merchantName}</h1>
          <p className="text-gray-500 text-sm mt-1">
            Paying {state.amount} {state.currency} <span className="text-gray-400">→ {state.payoutAsset} on {state.payoutChain}</span>
          </p>
        </div>

        {/* Main Content */}
        {state.status === 'COMPLETED' ? (
           <div className="text-center py-8">
             <div className="text-4xl mb-4">🎉</div>
             <h2 className="text-2xl font-bold text-green-600">Payment Successful</h2>
           </div>
        ) : (
            <>
            {state.depositAddress ? (
                <div className="flex flex-col items-center space-y-4">
                    <div className="bg-white p-2 border rounded-lg">
                        <QRCodeCanvas value={state.depositAddress} size={200} />
                    </div>
                    
                    <div className="w-full bg-gray-50 p-4 rounded-lg text-center">
                        <p className="text-sm text-gray-500 mb-1">Send exactly</p>
                        <p className="text-2xl font-mono font-bold text-gray-800 mb-4">
                            {state.expectedAmountInZec || '...'} ZEC
                        </p>
                        
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Deposit Address</p>
                        <p className="font-mono text-xs text-gray-600 break-all select-all bg-gray-100 p-2 rounded">
                            {state.depositAddress}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 text-gray-500">
                    Initializing payment...
                </div>
            )}
            </>
        )}

        {/* Status Footer */}
        <div className="border-t pt-4 text-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                state.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                state.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800 animate-pulse'
            }`}>
                {getStatusMessage(state.status)}
            </div>
        </div>
      </div>
    </div>
  );
}

