-- Drop tables (FK order: unlockedContent first, then unlockFee)
DROP TABLE IF EXISTS "unlocked_content";
DROP TABLE IF EXISTS "unlock_fee";
DROP TYPE IF EXISTS "unlockable_type";

-- Drop columns from resource table
ALTER TABLE "resource"
  DROP COLUMN IF EXISTS "is_locked",
  DROP COLUMN IF EXISTS "unlock_fee";

-- Remove "unlock" from purchase_type enum
-- (Postgres can't drop enum values directly; must recreate)
UPDATE "credit_purchase" SET "purchase_type" = 'credits' WHERE "purchase_type" = 'unlock';
ALTER TYPE "purchase_type" RENAME TO "purchase_type_old";
CREATE TYPE "purchase_type" AS ENUM ('credits');
ALTER TABLE "credit_purchase" ALTER COLUMN "purchase_type" DROP DEFAULT;
ALTER TABLE "credit_purchase"
  ALTER COLUMN "purchase_type" TYPE "purchase_type" USING "purchase_type"::text::"purchase_type";
ALTER TABLE "credit_purchase" ALTER COLUMN "purchase_type" SET DEFAULT 'credits'::"purchase_type";
DROP TYPE "purchase_type_old";
