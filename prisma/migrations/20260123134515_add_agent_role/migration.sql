-- Add AGENT role to AdminRole enum
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'AGENT';

-- Add new columns to Admin table
ALTER TABLE "Admin" 
ADD COLUMN IF NOT EXISTS "mobile_number" TEXT,
ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "verified_by" BIGINT,
ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3);

-- Add unique constraint on mobile_number (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Admin_mobile_number_key'
    ) THEN
        ALTER TABLE "Admin" ADD CONSTRAINT "Admin_mobile_number_key" UNIQUE ("mobile_number");
    END IF;
END $$;

-- Add foreign key constraint for verified_by (self-referential)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Admin_verified_by_fkey'
    ) THEN
        ALTER TABLE "Admin" 
        ADD CONSTRAINT "Admin_verified_by_fkey" 
        FOREIGN KEY ("verified_by") 
        REFERENCES "Admin"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;
