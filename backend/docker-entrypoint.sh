#!/bin/sh
set -e

echo "Waiting for database to be ready..."
# Wait for PostgreSQL using psql
for i in $(seq 1 30); do
  if PGPASSWORD=postgres psql -h db -U postgres -d payments -c "SELECT 1" > /dev/null 2>&1; then
    echo "Database is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "Database connection failed after 60 seconds"
    exit 1
  fi
  echo "Waiting for database... ($i/30)"
  sleep 2
done

echo "Running migrations..."
# Use migrate deploy (idempotent - safe to run multiple times)
npx prisma migrate deploy || echo "Migrations already applied or using migrate dev"

echo "Seeding database..."
npx prisma db seed || echo "Seed skipped (may already be seeded)"

echo "Starting application..."
exec "$@"
