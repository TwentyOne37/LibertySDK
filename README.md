# Liberty SDK - Multi-Chain Payment Backend

A NestJS backend for private cross-chain payments supporting Zcash (via NEAR Intents), EVM tokens (via 1inch Fusion+), and Solana (via Jupiter).

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)

### Running with Docker (One Command)

**Start everything:**
```bash
docker-compose up
```

This will automatically:
- Start PostgreSQL database
- Wait for database to be ready
- Run Prisma migrations
- Seed the database with a test merchant
- Start the NestJS backend

**Test the health endpoint:**
```bash
curl http://localhost:3000/api/health
```

### Local Development

1. **Start Postgres:**
   ```bash
   docker-compose up db
   ```

2. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Set up database:**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   ```

4. **Start the backend:**
   ```bash
   npm run start:dev
   ```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/merchants/:id` - Get merchant by ID
- `POST /api/payment-intents` - Create a payment intent
- `GET /api/payment-intents/:id` - Get payment intent by ID

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` - PostgreSQL connection string
- `NEAR_INTENTS_API_URL` - NEAR Intents API endpoint
- `NEAR_INTENTS_API_KEY` - NEAR Intents API key (if required)
- `ONEINCH_FUSION_API_URL` - 1inch Fusion+ API endpoint
- `ONEINCH_FUSION_API_KEY` - 1inch Fusion+ API key (if required)

## Project Structure

```
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

## Next Steps

- Implement NEAR Intents integration
- Implement 1inch Fusion+ integration
- Add payment intent status tracking
- Add webhook handlers for provider callbacks

