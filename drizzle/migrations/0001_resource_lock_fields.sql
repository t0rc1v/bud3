-- Add is_locked and unlock_fee columns to resource table
ALTER TABLE "resource" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "resource" ADD COLUMN "unlock_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
