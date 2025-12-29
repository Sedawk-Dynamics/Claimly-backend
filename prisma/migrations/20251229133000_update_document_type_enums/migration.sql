-- AlterEnum: Add new enum values
-- IMPORTANT: PostgreSQL doesn't allow using newly added enum values in the same transaction.
-- This migration ONLY adds enum values. Data updates must be done in a separate migration
-- after these enum values are committed to the database.

-- Add enum values (using IF NOT EXISTS check to avoid errors on re-run)
DO $$
BEGIN
    -- Add POLICY_DOCUMENT if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'POLICY_DOCUMENT' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PolicyDocumentType')
    ) THEN
        ALTER TYPE "PolicyDocumentType" ADD VALUE 'POLICY_DOCUMENT';
    END IF;

    -- Add NOMINEE_PAN if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'NOMINEE_PAN' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NomineeDocumentType')
    ) THEN
        ALTER TYPE "NomineeDocumentType" ADD VALUE 'NOMINEE_PAN';
    END IF;

    -- Add NOMINEE_AADHAAR if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'NOMINEE_AADHAAR' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NomineeDocumentType')
    ) THEN
        ALTER TYPE "NomineeDocumentType" ADD VALUE 'NOMINEE_AADHAAR';
    END IF;
END $$;

-- Note: We cannot directly remove enum values in PostgreSQL
-- The old values (POLICY_COPY, NOMINEE_ID, ADDRESS_PROOF) will remain in the enum
-- but won't be used by new records. To fully remove them, you would need to:
-- 1. Create a new enum with only the desired values
-- 2. Update the column to use the new enum
-- 3. Drop the old enum
-- This is more complex and may not be necessary if old values are not used

