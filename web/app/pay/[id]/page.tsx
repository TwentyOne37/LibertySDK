'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { fetchPaymentIntent, fetchPaymentStatus, quoteZec, quoteEvm, buildEvmSwapTx, confirmEvmTx } from '@/lib/api';

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
  oneInchStatus?: string;
}

type PaymentMethod = 'ZEC' | 'EVM';

export default function PaymentPage() {
  const params = useParams();
  const id = params.id as string;

  const [state, setState] = useState<PaymentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ZEC');

  // EVM State
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [evmToken, setEvmToken] = useState('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'); // ETH by default
  const [evmDecimals, setEvmDecimals] = useState(18);
  const [evmAmount, setEvmAmount] = useState('');
  const [evmQuote, setEvmQuote] = useState<any>(null);
  const [evmLoading, setEvmLoading] = useState(false);
  const [evmTxHash, setEvmTxHash] = useState('');

  // Initial Load & Polling
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let mounted = true;

    async function init() {
      try {
        const intent = await fetchPaymentIntent(id);
        
        let depositAddress = intent.intentsDepositAddress;
        let expectedAmountInZec = intent.intentsRawQuote?.depositAmount || intent.intentsRawQuote?.amount;

        // If CREATED and default ZEC, trigger Quote ZEC
        // But we only auto-quote ZEC if we are in ZEC mode or if it's the default flow.
        // For now, we'll keep the existing behavior: quote ZEC on load if status is CREATED.
        // However, if user switches to EVM, we might want to pause ZEC check or just ignore.
        if (intent.status === 'CREATED' && !intent.intentsDepositAddress) {
           // Only quote ZEC if we haven't yet
           try {
             const quote = await quoteZec(id);
             depositAddress = quote.depositAddress;
             expectedAmountInZec = quote.expectedAmountInZec;
             intent.status = quote.status; // Update status locally
           } catch (err) {
             console.error('ZEC Quote failed', err);
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
            oneInchStatus: intent.oneInchStatus,
          });
          setLoading(false);
        }

        // Poll Status
        if (intent.status !== 'COMPLETED' && intent.status !== 'FAILED') {
          intervalId = setInterval(async () => {
            try {
              const statusData = await fetchPaymentStatus(id);
              if (mounted) {
                setState((prev) => prev ? { 
                    ...prev, 
                    status: statusData.status,
                    oneInchStatus: statusData.oneInchStatus 
                } : null);
                
                if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED') {
                  clearInterval(intervalId);
                }
              }
            } catch (e) {
              console.error('Polling error', e);
            }
          }, 5000);
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

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
      } catch (error) {
        console.error('Failed to connect wallet', error);
        alert('Failed to connect wallet');
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  const handleGetEvmQuote = async () => {
    if (!walletAddress || !evmAmount) return;
    setEvmLoading(true);
    try {
      const chainIdHex = await (window as any).ethereum.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);

      const data = await quoteEvm(id, {
        chainId,
        fromTokenAddress: evmToken,
        fromTokenDecimals: evmDecimals,
        amountDecimal: evmAmount,
      });
      setEvmQuote(data);
    } catch (error: any) {
      console.error('Quote EVM error', error);
      alert('Failed to get EVM quote: ' + error.message);
    } finally {
      setEvmLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!evmQuote || !walletAddress) return;
    setEvmLoading(true);
    try {
       const chainIdHex = await (window as any).ethereum.request({ method: 'eth_chainId' });
       const chainId = parseInt(chainIdHex, 16);

       // Build Tx
       const txData = await buildEvmSwapTx(id, {
         chainId,
         fromTokenAddress: evmToken,
         userAddress: walletAddress,
         slippageBps: 100, // 1%
       });

       // Send Tx
       const txHash = await (window as any).ethereum.request({
         method: 'eth_sendTransaction',
         params: [txData],
       });

       setEvmTxHash(txHash);

       // Confirm Backend
       await confirmEvmTx(id, txHash);
       
       // Force status update or just let polling handle it
       if (state) {
           setState({ ...state, status: 'COMPLETED' });
       }

    } catch (error: any) {
       console.error('Swap failed', error);
       alert('Swap failed: ' + error.message);
    } finally {
       setEvmLoading(false);
    }
  };

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
        return 'Waiting for payment...';
      case 'SWAPPING':
      case 'PENDING_DEPOSIT':
        return 'Processing...';
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

        {/* Tabs */}
        {state.status !== 'COMPLETED' && (
            <div className="flex border-b">
                <button
                    className={`flex-1 py-2 text-sm font-medium ${paymentMethod === 'ZEC' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setPaymentMethod('ZEC')}
                >
                    Pay with ZEC
                </button>
                <button
                    className={`flex-1 py-2 text-sm font-medium ${paymentMethod === 'EVM' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setPaymentMethod('EVM')}
                >
                    Pay with EVM
                </button>
            </div>
        )}

        {/* Main Content */}
        {state.status === 'COMPLETED' ? (
           <div className="text-center py-8">
             <div className="text-4xl mb-4">🎉</div>
             <h2 className="text-2xl font-bold text-green-600">Payment Successful</h2>
             {evmTxHash && (
                 <p className="text-xs text-gray-400 mt-2 break-all">Tx: {evmTxHash}</p>
             )}
           </div>
        ) : (
            <>
            {paymentMethod === 'ZEC' ? (
                state.depositAddress ? (
                    <div className="flex flex-col items-center space-y-4 animate-fadeIn">
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
                        Loading ZEC address...
                    </div>
                )
            ) : (
                // EVM Flow
                <div className="space-y-4 animate-fadeIn">
                    {!walletAddress ? (
                        <div className="text-center py-8">
                            <p className="text-gray-600 mb-4">Connect your wallet to pay with tokens on Ethereum, BNB, Polygon, etc.</p>
                            <button
                                onClick={connectWallet}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                Connect MetaMask
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                             <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500 break-all">
                                 Connected: {walletAddress}
                             </div>

                             <div>
                                 <label className="block text-xs font-medium text-gray-700 mb-1">Token Address</label>
                                 <input 
                                    type="text" 
                                    value={evmToken}
                                    onChange={(e) => setEvmToken(e.target.value)}
                                    className="w-full border rounded p-2 text-sm"
                                    placeholder="0x..."
                                 />
                                 <p className="text-[10px] text-gray-400 mt-1">Default is Native Token (ETH/BNB/etc)</p>
                             </div>
                             
                             <div className="flex gap-4">
                                 <div className="flex-1">
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                                     <input 
                                        type="text" 
                                        value={evmAmount}
                                        onChange={(e) => setEvmAmount(e.target.value)}
                                        className="w-full border rounded p-2 text-sm"
                                        placeholder="0.0"
                                     />
                                 </div>
                                 <div className="w-20">
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Decimals</label>
                                     <input 
                                        type="number" 
                                        value={evmDecimals}
                                        onChange={(e) => setEvmDecimals(parseInt(e.target.value))}
                                        className="w-full border rounded p-2 text-sm"
                                     />
                                 </div>
                             </div>

                             <button
                                onClick={handleGetEvmQuote}
                                disabled={evmLoading || !evmAmount}
                                className="w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-900 disabled:opacity-50"
                             >
                                {evmLoading ? 'Calculating...' : 'Get Quote'}
                             </button>

                             {evmQuote && (
                                 <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                     <p className="text-sm text-gray-700 mb-2">
                                         You pay: <strong>{evmAmount}</strong> <span className="text-xs text-gray-500">({evmToken.slice(0,6)}...)</span>
                                     </p>
                                     <p className="text-sm text-gray-700 mb-4">
                                         Merchant receives: <strong>{(BigInt(evmQuote.expectedAmountOut || 0) / BigInt(1e6)).toString()}</strong> <span className="text-xs text-gray-500">USDC/USDT (approx)</span>
                                     </p>
                                     <button
                                        onClick={handleSwap}
                                        disabled={evmLoading}
                                        className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50"
                                     >
                                        {evmLoading ? 'Processing...' : 'Confirm & Pay'}
                                     </button>
                                 </div>
                             )}
                        </div>
                    )}
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
