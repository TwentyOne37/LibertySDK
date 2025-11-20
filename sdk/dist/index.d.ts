export type PaymentMode = 'cheapest' | 'privacy' | 'manual';
export interface CreatePaymentIntentParams {
    merchantId: string;
    amount: string;
    currency: string;
    payoutAsset: string;
    payoutChain: string;
    mode?: PaymentMode;
}
export interface PaymentIntent {
    id: string;
    merchantId: string;
    amount: string;
    currency: string;
    payoutAsset: string;
    payoutChain: string;
    status: string;
    mode: string;
    provider?: string | null;
    intentsDepositAddress?: string | null;
    expectedAmountInZec?: string | null;
    intentsRawQuote?: any;
}
export interface PaymentStatus {
    id: string;
    status: string;
    provider?: string | null;
    amount: string;
    currency: string;
    payoutAsset: string;
    payoutChain: string;
}
export interface LibertyPayClientOptions {
    baseUrl: string;
    apiKey?: string;
}
export declare class LibertyPayClient {
    private options;
    private client;
    constructor(options: LibertyPayClientOptions);
    createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent>;
    getPaymentIntent(id: string): Promise<PaymentIntent>;
    getStatus(id: string): Promise<PaymentStatus>;
}
