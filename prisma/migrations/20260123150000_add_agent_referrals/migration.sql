-- Add referral_code to Admin for agent referral codes
ALTER TABLE "Admin"
ADD COLUMN IF NOT EXISTS "referral_code" VARCHAR(191);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Admin_referral_code_key'
  ) THEN
    CREATE UNIQUE INDEX "Admin_referral_code_key" ON "Admin"("referral_code");
  END IF;
END $$;

-- Add referred_by_agent to User and link to Admin
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "referred_by_agent" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'User_referred_by_agent_fkey'
  ) THEN
    ALTER TABLE "User"
    ADD CONSTRAINT "User_referred_by_agent_fkey"
    FOREIGN KEY ("referred_by_agent") REFERENCES "Admin"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

