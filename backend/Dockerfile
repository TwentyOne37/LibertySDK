FROM node:20-slim

WORKDIR /app

# Install PostgreSQL client for health checks and OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl postgresql-client

# Install Prisma CLI globally for migrations
RUN npm install -g prisma

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies using npm install to ensure lockfile is updated if needed
# (npm ci fails if lockfile is out of sync, which happens when we manually edit package.json)
RUN npm install

# Copy source code
COPY . .

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Generate Prisma Client
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start:dev"]
