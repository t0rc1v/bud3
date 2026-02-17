CREATE TABLE "super_admin_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"super_admin_id" uuid NOT NULL,
	"admin_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "super_admin_regulars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"super_admin_id" uuid NOT NULL,
	"regular_id" uuid NOT NULL,
	"regular_email" varchar(255) NOT NULL,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "super_admin_admins" ADD CONSTRAINT "super_admin_admins_super_admin_id_user_id_fk" FOREIGN KEY ("super_admin_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin_admins" ADD CONSTRAINT "super_admin_admins_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin_regulars" ADD CONSTRAINT "super_admin_regulars_super_admin_id_user_id_fk" FOREIGN KEY ("super_admin_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin_regulars" ADD CONSTRAINT "super_admin_regulars_regular_id_user_id_fk" FOREIGN KEY ("regular_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;