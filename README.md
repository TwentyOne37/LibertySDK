## 📦 Liberty SDK

**One SDK. Any chain. Private by default.**

Liberty SDK is a privacy-preserving, cross-chain payment SDK for Zcash, EVM chains, Solana, and NEAR.

It lets developers accept crypto from any chain and settle into stablecoins or ZEC—while preserving user privacy and abstracting away swaps, bridges, and cross-chain execution.

---

## ⚡️ What Liberty SDK Does

- **Accept Zcash payments**: Shielded or transparent ZEC.
- **Accept EVM tokens**: Via 1inch Fusion+.
- **Accept Solana tokens**: Via Jupiter.
- **Handle cross-chain routing**: Using NEAR Intents.
- **Automatically settle merchants into**:
  - **USDC/USDT** on a preferred EVM or Solana chain.
  - **ZEC** (shielded or transparent).

All without custody, and without leaking the user’s transaction graph.

---

## 🧠 Why Liberty SDK?

Today, crypto payments are often:

- **Single-chain only**: Hard to support users on “the wrong chain”.
- **Integration-heavy**: Messy swap/bridge integrations per chain.
- **Privacy-leaking**: User transaction history is exposed.
- **Hard to implement safely**: Many edge cases and security pitfalls.

**Liberty SDK solves this with one integration.**

It abstracts:

- **Shielded → unshielded ZEC flows**.
- **1inch Fusion+ swap orchestration** on EVM.
- **Jupiter routing** on Solana.
- **NEAR Intents cross-chain execution**.
- **Settlement guarantees** and **payment-link creation**.
- **Non-custodial security** so you never take custody of user funds.

Your application gets a clean payment API, and users get true privacy.

---

## 🚀 SDK Quick Start

### Installation

```bash
npm install libertysdk
# or
yarn add libertysdk
```

### Example: Create a Cross-Chain Private Payment

```ts
import { Liberty } from "libertysdk";

const sdk = new Liberty({
  merchant: {
    receiveChain: "polygon",
    receiveAsset: "USDC",
  },
});

const paymentLink = await sdk.createPaymentLink({
  amount: "25",
  currency: "USD",
});

console.log("Payment link:", paymentLink.url);
```

### Example Demo

See `examples/simple-payment-link` for a minimal working implementation of payment-link creation (Stripe-like experience).

---

## 🧩 Key Features

- **🔒 Privacy-preserving**: Supports shielded ZEC; minimizes transaction graph leakage.
- **🔀 Cross-chain by default**: NEAR Intents handles routing and execution.
- **🔁 Swap-abstracted**: 1inch (EVM) and Jupiter (Solana) are built-in.
- **🧩 Composable**: Integrate into wallets, checkouts, or any dApp flow.
- **💳 Payment-link ready**: Create one-time or reusable payment links.
- **⚙️ Non-custodial**: You never take custody of user funds.
- **🌐 Multi-chain**: Zcash + EVM + Solana support out of the box.

---

## 🏗 Backend Service in This Repo

This repository currently contains the **Liberty SDK backend**, implemented as a **NestJS** service for multi-chain, privacy-preserving payments. It powers merchant configuration, payment intents, and integrations with NEAR Intents, 1inch Fusion+, and other services.

The backend is designed to be run either via **Docker Compose** (for easy local setup) or directly via **Node.js** for development.

---

## 🔧 Backend Quick Start

### Prerequisites

- **Docker and Docker Compose**
- **Node.js 20+** (for local backend development)

### Running with Docker (One Command)

- **Start everything:**

```bash
docker-compose up
```

This will automatically:

- **Start** the PostgreSQL database.
- **Wait** for the database to be ready.
- **Run** Prisma migrations.
- **Seed** the database with a test merchant.
- **Start** the NestJS backend.

- **Test the health endpoint:**

```bash
curl http://localhost:3000/api/health
```

### Local Backend Development

1. **Start Postgres:**

   ```bash
   docker-compose up db
   ```

2. **Install backend dependencies:**

   ```bash
   cd backend
   npm install
   ```

3. **Set up the database (Prisma):**

   ```bash
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   ```

4. **Start the backend in watch mode:**

   ```bash
   npm run start:dev
   ```

The backend will be available by default at `http://localhost:3000`.

---

## 🌐 Backend API Endpoints

- **`GET /api/health`**: Basic health check.
- **`GET /api/merchants/:id`**: Get merchant by ID.
- **`POST /api/payment-intents`**: Create a payment intent.
- **`GET /api/payment-intents/:id`**: Get payment intent by ID.

These endpoints back the higher-level SDK operations such as creating payment links and tracking settlement status.

---

## 🔑 Backend Environment Variables

Copy `.env.example` to `.env` in the `backend` directory and configure:

- **`DATABASE_URL`**: PostgreSQL connection string.
- **`NEAR_INTENTS_API_URL`**: NEAR Intents API endpoint.
- **`NEAR_INTENTS_API_KEY`**: NEAR Intents API key (if required).
- **`ONEINCH_FUSION_API_URL`**: 1inch Fusion+ API endpoint.
- **`ONEINCH_FUSION_API_KEY`**: 1inch Fusion+ API key (if required).

You may also add any additional provider- or environment-specific configuration as the integration surface grows.

---

## 🗂 Repository Structure (Backend)

```text
backend/
├── src/
│   ├── modules/          # Feature modules
│   │   ├── health/       # Health check endpoint
│   │   ├── merchants/    # Merchant management
│   │   ├── payments/     # Payment intents
│   │   └── prisma/       # Prisma service
│   ├── integrations/     # External service clients
│   │   ├── near-intents.client.ts
│   │   └── oneinch-fusion.client.ts
│   ├── app.module.ts     # Root module
│   └── main.ts           # Application entry point
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seed script
└── Dockerfile
```

---

## 📚 Documentation

- **Overview**: What Liberty SDK is and how it works (this README).
- **Installation**: SDK & backend installation steps.
- **Architecture**: How the SDK, backend, and external services interact.
- **Roadmap**: Planned features and improvements.
- **Examples**: Sample integrations such as `examples/simple-payment-link`.

More formal documentation and reference guides are coming soon.

---

## 🗺 Roadmap (High-Level)

- **Additional settlement chains** and assets.
- **zk-native payment proofs** for stronger guarantees.
- **Native merchant dashboard** for managing payment flows.
- **More NEAR Intents patterns** and cross-chain flows.
- **Pay-in subscription flows** and recurring billing.
- **SDK bindings** for additional languages (e.g. Rust, Python).

Contributions and ideas are very welcome.

---

## 🤝 Contributing

Want to improve Liberty SDK or add a new adapter or integration?

- **Open an issue** to discuss design, architecture, or new features.
- **Submit a PR** for bug fixes, improvements, or new modules.

Please keep changes well-scoped and include tests where applicable.

---

## ⚖️ License

Liberty SDK is released under the **MIT License** — free and open-source.

