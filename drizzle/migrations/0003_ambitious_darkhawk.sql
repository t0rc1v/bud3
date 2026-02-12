ALTER TABLE "credit_transaction" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_credit" ADD COLUMN "expired_credits" integer DEFAULT 0 NOT NULL;