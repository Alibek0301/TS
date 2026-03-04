#!/bin/sh
set -e

if [ -d "prisma/migrations" ]; then
  echo "Applying Prisma migrations..."
  npx prisma migrate deploy
else
  echo "No prisma/migrations found, syncing schema with db push..."
  npx prisma db push
fi

echo "Starting backend..."
node dist/server.js
