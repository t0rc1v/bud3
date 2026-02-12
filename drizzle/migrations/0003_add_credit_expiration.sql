-- Add credit expiration fields

-- Add expires_at column to credit_transaction table
ALTER TABLE "credit_transaction" ADD COLUMN "expires_at" timestamp with time zone;

-- Create index on expires_at for efficient querying
CREATE INDEX "idx_credit_transaction_expires_at" ON "credit_transaction" ("expires_at");

-- Create composite index on user_id and expires_at
CREATE INDEX "idx_credit_transaction_user_expires_at" ON "credit_transaction" ("user_id", "expires_at");

-- Add expired_credits column to user_credit table
ALTER TABLE "user_credit" ADD COLUMN "expired_credits" integer DEFAULT 0 NOT NULL;
