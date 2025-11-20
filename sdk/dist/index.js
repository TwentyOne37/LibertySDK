"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibertyPayClient = void 0;
const axios_1 = __importDefault(require("axios"));
class LibertyPayClient {
    constructor(options) {
        this.options = options;
        this.client = axios_1.default.create({
            baseURL: options.baseUrl,
            headers: options.apiKey ? { 'x-api-key': options.apiKey } : {},
        });
    }
    async createPaymentIntent(params) {
        try {
            // Map lowercase mode to uppercase for backend
            const modeMap = {
                'cheapest': 'CHEAPEST',
                'privacy': 'PRIVACY',
                'manual': 'MANUAL'
            };
            const backendMode = params.mode ? modeMap[params.mode] : 'CHEAPEST';
            const response = await this.client.post('/payment-intents', {
                ...params,
                mode: backendMode,
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Failed to create payment intent: ${error.response?.data?.message || error.message}`);
        }
    }
    async getPaymentIntent(id) {
        try {
            const response = await this.client.get(`/payment-intents/${id}`);
            return response.data;
        }
        catch (error) {
            throw new Error(`Failed to get payment intent: ${error.response?.data?.message || error.message}`);
        }
    }
    async getStatus(id) {
        try {
            const response = await this.client.get(`/payment-intents/${id}/status`);
            return response.data;
        }
        catch (error) {
            throw new Error(`Failed to get payment status: ${error.response?.data?.message || error.message}`);
        }
    }
}
exports.LibertyPayClient = LibertyPayClient;
