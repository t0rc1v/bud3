CREATE TYPE "public"."purchase_type" AS ENUM('credits', 'unlock');--> statement-breakpoint
ALTER TABLE "credit_purchase" ADD COLUMN "purchase_type" "purchase_type" DEFAULT 'credits' NOT NULL;