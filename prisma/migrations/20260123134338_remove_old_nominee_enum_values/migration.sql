-- Remove old enum values from NomineeDocumentType
-- PostgreSQL doesn't support removing enum values directly, so we need to:
-- 1. Ensure all data uses new enum values (handle old values that might exist)
-- 2. Create a new enum with only desired values
-- 3. Update the column to use the new enum
-- 4. Drop the old enum

-- Step 1: Update any remaining records that might still use old enum values
-- Use text comparison to avoid enum casting issues
DO $$
BEGIN
    -- Update NOMINEE_ID to NOMINEE_PAN
    UPDATE "NomineeDocument" 
    SET "document_type" = 'NOMINEE_PAN'::"NomineeDocumentType"
    WHERE "document_type"::text = 'NOMINEE_ID';

    -- Update ADDRESS_PROOF to NOMINEE_AADHAAR
    UPDATE "NomineeDocument" 
    SET "document_type" = 'NOMINEE_AADHAAR'::"NomineeDocumentType"
    WHERE "document_type"::text = 'ADDRESS_PROOF';
END $$;

-- Step 2: Create a new enum with only the desired values
DO $$
BEGIN
    -- Check if the new enum already exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NomineeDocumentType_new') THEN
        CREATE TYPE "NomineeDocumentType_new" AS ENUM ('NOMINEE_PAN', 'NOMINEE_AADHAAR', 'OTHER');
    END IF;
END $$;

-- Step 3: Update the column to use the new enum
-- Cast through text to handle the migration
ALTER TABLE "NomineeDocument" 
ALTER COLUMN "document_type" TYPE "NomineeDocumentType_new" 
USING CASE 
    WHEN "document_type"::text = 'NOMINEE_PAN' THEN 'NOMINEE_PAN'::"NomineeDocumentType_new"
    WHEN "document_type"::text = 'NOMINEE_AADHAAR' THEN 'NOMINEE_AADHAAR'::"NomineeDocumentType_new"
    WHEN "document_type"::text = 'OTHER' THEN 'OTHER'::"NomineeDocumentType_new"
    WHEN "document_type"::text = 'NOMINEE_ID' THEN 'NOMINEE_PAN'::"NomineeDocumentType_new"
    WHEN "document_type"::text = 'ADDRESS_PROOF' THEN 'NOMINEE_AADHAAR'::"NomineeDocumentType_new"
    ELSE 'OTHER'::"NomineeDocumentType_new"
END;

-- Step 4: Drop the old enum and rename the new one
DROP TYPE "NomineeDocumentType";
ALTER TYPE "NomineeDocumentType_new" RENAME TO "NomineeDocumentType";
