ALTER TABLE "resource" ADD COLUMN "is_locked" boolean DEFAULT true NOT NULL;--> statement-breakpoint

-- Update existing resources to be locked by default
UPDATE "resource" SET "is_locked" = true WHERE "is_locked" IS NULL;