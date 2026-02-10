ALTER TABLE "credit_config" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "credit_config" CASCADE;--> statement-breakpoint
ALTER TABLE "unlocked_content" DROP CONSTRAINT "unlocked_content_transaction_id_credit_transaction_id_fk";
--> statement-breakpoint
ALTER TABLE "unlocked_content" ADD COLUMN "payment_reference" varchar(100);--> statement-breakpoint
ALTER TABLE "unlocked_content" ADD COLUMN "amount_paid_kes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "resource" DROP COLUMN "is_locked";--> statement-breakpoint
ALTER TABLE "unlocked_content" DROP COLUMN "credits_used";--> statement-breakpoint
ALTER TABLE "unlocked_content" DROP COLUMN "transaction_id";