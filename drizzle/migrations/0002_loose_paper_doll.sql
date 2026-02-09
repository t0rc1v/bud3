CREATE TABLE "ai_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"chat_id" uuid,
	"title" varchar(255) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"grade" varchar(100) NOT NULL,
	"type" varchar(50) NOT NULL,
	"instructions" text NOT NULL,
	"total_marks" integer NOT NULL,
	"time_limit" integer,
	"due_date" timestamp with time zone,
	"include_answer_key" boolean DEFAULT true NOT NULL,
	"questions" jsonb NOT NULL,
	"answer_key" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_quiz" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"chat_id" uuid,
	"title" varchar(255) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"total_marks" integer NOT NULL,
	"passing_score" integer DEFAULT 60 NOT NULL,
	"time_limit" integer,
	"settings" jsonb NOT NULL,
	"questions" jsonb NOT NULL,
	"validation" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_quiz_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"total_marks" integer NOT NULL,
	"percentage" integer NOT NULL,
	"passed" boolean NOT NULL,
	"time_taken" integer,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "chat_resource" CASCADE;--> statement-breakpoint
ALTER TABLE "ai_assignment" ADD CONSTRAINT "ai_assignment_user_id_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_assignment" ADD CONSTRAINT "ai_assignment_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_quiz" ADD CONSTRAINT "ai_quiz_user_id_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_quiz" ADD CONSTRAINT "ai_quiz_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_quiz_attempt" ADD CONSTRAINT "ai_quiz_attempt_quiz_id_ai_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."ai_quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_quiz_attempt" ADD CONSTRAINT "ai_quiz_attempt_user_id_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id") ON DELETE cascade ON UPDATE no action;