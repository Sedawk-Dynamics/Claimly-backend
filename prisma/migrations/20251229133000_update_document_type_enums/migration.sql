-- AlterEnum: Add new enum values
ALTER TYPE "PolicyDocumentType" ADD VALUE IF NOT EXISTS 'POLICY_DOCUMENT';
ALTER TYPE "NomineeDocumentType" ADD VALUE IF NOT EXISTS 'NOMINEE_PAN';
ALTER TYPE "NomineeDocumentType" ADD VALUE IF NOT EXISTS 'NOMINEE_AADHAAR';

-- Update existing records: POLICY_COPY -> POLICY_DOCUMENT
UPDATE "PolicyDocument" 
SET "document_type" = 'POLICY_DOCUMENT' 
WHERE "document_type" = 'POLICY_COPY';

-- Update existing records: NOMINEE_ID -> NOMINEE_PAN
UPDATE "NomineeDocument" 
SET "document_type" = 'NOMINEE_PAN' 
WHERE "document_type" = 'NOMINEE_ID';

-- Update existing records: ADDRESS_PROOF -> NOMINEE_AADHAAR
UPDATE "NomineeDocument" 
SET "document_type" = 'NOMINEE_AADHAAR' 
WHERE "document_type" = 'ADDRESS_PROOF';

-- Note: We cannot directly remove enum values in PostgreSQL
-- The old values (POLICY_COPY, NOMINEE_ID, ADDRESS_PROOF) will remain in the enum
-- but won't be used by new records. To fully remove them, you would need to:
-- 1. Create a new enum with only the desired values
-- 2. Update the column to use the new enum
-- 3. Drop the old enum
-- This is more complex and may not be necessary if old values are not used

