CREATE TABLE "ai_exam" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" uuid,
	"title" varchar(255) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"level" varchar(100) NOT NULL,
	"instructions" text NOT NULL,
	"total_marks" integer NOT NULL,
	"time_limit" integer,
	"sections" jsonb NOT NULL,
	"answer_key" jsonb,
	"include_answer_key" boolean DEFAULT true NOT NULL,
	"resource_ids" jsonb,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_notes_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" uuid,
	"title" varchar(255) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"topic" varchar(255),
	"level" varchar(100),
	"sections" jsonb NOT NULL,
	"key_terms" jsonb,
	"youtube_videos" jsonb,
	"images" jsonb,
	"summary" text,
	"resource_ids" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_exam" ADD CONSTRAINT "ai_exam_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_exam" ADD CONSTRAINT "ai_exam_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_notes_document" ADD CONSTRAINT "ai_notes_document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_notes_document" ADD CONSTRAINT "ai_notes_document_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;
