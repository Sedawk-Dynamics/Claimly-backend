-- CreateTable
CREATE TABLE IF NOT EXISTS "OfferBanner" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT,
    "image_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferBanner_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'OfferBanner_created_by_fkey'
    ) THEN
        ALTER TABLE "OfferBanner" ADD CONSTRAINT "OfferBanner_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

