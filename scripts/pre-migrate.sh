#!/bin/sh
# Pre-migration script to resolve failed migrations before running migrate deploy

echo "🔍 Checking for failed migrations..."

# Check if the specific migration failed and resolve it
# This migration adds enum values which are safe to re-run
# We'll mark it as rolled-back so it can be re-applied
MIGRATION_NAME="20251229133000_update_document_type_enums"

# Try to resolve the failed migration (ignore errors if migration doesn't exist or is already resolved)
npx prisma migrate resolve --rolled-back "$MIGRATION_NAME" 2>/dev/null && \
  echo "✅ Resolved failed migration: $MIGRATION_NAME" || \
  echo "ℹ️  Migration $MIGRATION_NAME not found or already resolved"

# Then run the actual migration
echo "🚀 Running database migrations..."
npx prisma migrate deploy

