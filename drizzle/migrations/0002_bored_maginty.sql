CREATE TABLE "ai_flashcard" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" uuid,
	"title" varchar(255) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"topic" varchar(255),
	"total_cards" integer NOT NULL,
	"cards" jsonb NOT NULL,
	"settings" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_flashcard" ADD CONSTRAINT "ai_flashcard_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_flashcard" ADD CONSTRAINT "ai_flashcard_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;