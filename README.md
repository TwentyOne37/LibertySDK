# LibertySDK

**One SDK. Any chain. Private by default.**

LibertySDK is a multi-chain payment infrastructure that lets merchants accept privacy-preserving payments and settle automatically in stablecoins on their preferred chain.

Current flow: **ZEC (Shielded) → USDC (EVM)** via **NEAR Intents**.

## ⚡️ Features

- **Multi-Chain Settlement**: Accept ZEC, settle in USDC on Ethereum, Polygon, or Base.
- **Privacy First**: Supports shielded ZEC inputs, preventing transaction graph leaks.
- **Intent-Based Routing**: Leverages NEAR Intents for optimal cross-chain execution.
- **Drop-in SDK**: Simple Node.js client for backend integration.
- **Docker Ready**: Complete environment setup in one command.

## 🚀 Quickstart

Get the full stack (Backend, Web App, DB) running in minutes.

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-org/LibertySDK.git
   cd LibertySDK
   ```

2. **Start with Docker**
   ```bash
   docker-compose up --build
   ```
   *Starts NestJS backend (port 3001), Next.js web app (port 3000), and Postgres.*

3. **Create a Test Intent**
   - **Web UI**: Go to [http://localhost:3000/dev/create-intent](http://localhost:3000/dev/create-intent) to generate a payment link via the UI.
   - **SDK**: Run the included example:
     ```bash
     cd sdk
     npm install
     npx ts-node examples/create-intent.ts
     ```

## 🛠 SDK Usage

The SDK is designed for Node.js backends to create payment intents programmatically.

```typescript
import { LibertyPayClient } from 'liberty-pay/sdk';

const client = new LibertyPayClient({
  baseUrl: 'http://localhost:3001/api', // Backend API URL
  apiKey: 'your-api-key',
});

// Create a ZEC -> USDC payment intent
const intent = await client.createPaymentIntent({
  merchantId: '00000000-0000-0000-0000-000000000001',
  amount: '50.00',
  currency: 'USD',
  payoutAsset: 'USDC',
  payoutChain: 'ethereum',
  mode: 'cheapest', // or 'privacy'
});

console.log(`Payment Link: http://localhost:3000/pay/${intent.id}`);
```

## 💻 Development

The repository is a monorepo containing:

- **`backend/`**: NestJS API (`/api/payment-intents`) managing intent lifecycle.
- **`web/`**: Next.js application for the payment checkout experience (`/pay/[id]`).
- **`sdk/`**: TypeScript client library (`liberty-pay/sdk`).

### Local Services
| Service | URL / Port | Description |
|---------|------------|-------------|
| **Web App** | `http://localhost:3000` | Checkout UI & Dev Tools |
| **Backend API** | `http://localhost:3001/api` | Core Logic & DB Access |
| **Database** | `localhost:5432` | PostgreSQL (User/Pass: postgres/postgres) |

## 🗺 Roadmap & Extensibility

LibertySDK is built to extend beyond the initial ZEC → USDC flow.

- [ ] **1inch Fusion+**: Native EVM → EVM cross-chain swaps.
- [ ] **Solana (Jupiter)**: High-speed Solana settlements.
- [ ] **Expanded Asset Support**: DAI, USDT, and other privacy tokens.

## ⚖️ License

Released under the **MIT License**.
