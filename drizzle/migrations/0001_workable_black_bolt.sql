ALTER TABLE "admin_regulars" DROP CONSTRAINT "admin_regulars_level_id_level_id_fk";
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "name" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "level" varchar(100);--> statement-breakpoint
ALTER TABLE "admin_regulars" DROP COLUMN "level_id";