CREATE TYPE "public"."resource_status_enum" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_view" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_seconds" integer
);
--> statement-breakpoint
ALTER TABLE "resource" ADD COLUMN "status" "resource_status_enum" DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_view" ADD CONSTRAINT "resource_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_view" ADD CONSTRAINT "resource_view_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "resource_view_user_resource_idx" ON "resource_view" USING btree ("user_id","resource_id");--> statement-breakpoint
CREATE INDEX "resource_view_resource_idx" ON "resource_view" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_view_viewed_at_idx" ON "resource_view" USING btree ("viewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_admin_regulars" ON "admin_regulars" USING btree ("admin_id","regular_id");--> statement-breakpoint
CREATE INDEX "credit_purchase_status_idx" ON "credit_purchase" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credit_purchase_user_status_idx" ON "credit_purchase" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ct_expires_at_idx" ON "credit_transaction" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ct_user_expires_at_idx" ON "credit_transaction" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "ct_user_type_expires_at_idx" ON "credit_transaction" USING btree ("user_id","type","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_role_permission" ON "role_permission" USING btree ("role_id","permission");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_super_admin_admins" ON "super_admin_admins" USING btree ("super_admin_id","admin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_super_admin_regulars" ON "super_admin_regulars" USING btree ("super_admin_id","regular_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_unlock_fee_resource" ON "unlock_fee" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_unlock_fee_topic" ON "unlock_fee" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_unlock_fee_subject" ON "unlock_fee" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "unlock_fee_is_active_idx" ON "unlock_fee" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_unlocked_content" ON "unlocked_content" USING btree ("user_id","unlock_fee_id");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_user_credit" ON "user_credit" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_user_permission" ON "user_permission" USING btree ("user_id","permission");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_user_roles" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
ALTER TABLE "unlock_fee" ADD CONSTRAINT "chk_unlock_fee_exactly_one_fk" CHECK ((resource_id IS NOT NULL)::int + (topic_id IS NOT NULL)::int + (subject_id IS NOT NULL)::int = 1);