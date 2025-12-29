-- Update existing records to use new enum values
-- This migration runs AFTER enum values are committed, so it's safe to use them

-- Update existing records: POLICY_COPY -> POLICY_DOCUMENT
UPDATE "PolicyDocument" 
SET "document_type" = 'POLICY_DOCUMENT'::"PolicyDocumentType"
WHERE "document_type" = 'POLICY_COPY'::"PolicyDocumentType";

-- Update existing records: NOMINEE_ID -> NOMINEE_PAN
UPDATE "NomineeDocument" 
SET "document_type" = 'NOMINEE_PAN'::"NomineeDocumentType"
WHERE "document_type" = 'NOMINEE_ID'::"NomineeDocumentType";

-- Update existing records: ADDRESS_PROOF -> NOMINEE_AADHAAR
UPDATE "NomineeDocument" 
SET "document_type" = 'NOMINEE_AADHAAR'::"NomineeDocumentType"
WHERE "document_type" = 'ADDRESS_PROOF'::"NomineeDocumentType";

-- Note: The old enum values (POLICY_COPY, NOMINEE_ID, ADDRESS_PROOF) remain in the enum
-- for backward compatibility but won't be used by new records.

