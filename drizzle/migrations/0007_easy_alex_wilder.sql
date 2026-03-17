CREATE TYPE "public"."curriculum_import_status" AS ENUM('uploading', 'extracting', 'processing', 'review', 'approved', 'applied', 'failed');--> statement-breakpoint
CREATE TYPE "public"."flashcard_rating" AS ENUM('again', 'hard', 'good', 'easy');--> statement-breakpoint
CREATE TYPE "public"."grade_by" AS ENUM('ai', 'teacher');--> statement-breakpoint
CREATE TYPE "public"."grade_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."study_plan_status" AS ENUM('active', 'completed', 'paused');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('submitted', 'grading', 'graded', 'reviewed', 'published');--> statement-breakpoint
CREATE TYPE "public"."tutor_mode" AS ENUM('socratic', 'guided', 'practice');--> statement-breakpoint
CREATE TYPE "public"."tutor_session_status" AS ENUM('active', 'completed');--> statement-breakpoint
CREATE TABLE "ai_grade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"graded_by" "grade_by" NOT NULL,
	"teacher_id" uuid,
	"total_score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"percentage" integer NOT NULL,
	"passed" boolean NOT NULL,
	"per_question_feedback" jsonb NOT NULL,
	"overall_feedback" text,
	"rubric" jsonb,
	"ai_confidence" integer,
	"teacher_overrides" jsonb,
	"status" "grade_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_grade_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
CREATE TABLE "ai_quality_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"originality_score" integer,
	"similarity_results" jsonb,
	"quality_feedback" jsonb,
	"flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exam_id" uuid,
	"assignment_id" uuid,
	"type" varchar(20) NOT NULL,
	"answers" jsonb NOT NULL,
	"file_url" text,
	"status" "submission_status" DEFAULT 'submitted' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_import" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" varchar(20) NOT NULL,
	"source_resource_id" uuid,
	"source_url" text,
	"extracted_content" jsonb,
	"proposed_structure" jsonb,
	"status" "curriculum_import_status" DEFAULT 'uploading' NOT NULL,
	"applied_entities" jsonb,
	"error_message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flashcard_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flashcard_set_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" varchar(100) NOT NULL,
	"rating" "flashcard_rating" NOT NULL,
	"interval" integer NOT NULL,
	"ease_factor" integer NOT NULL,
	"next_review_date" timestamp with time zone NOT NULL,
	"review_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"generated_by" uuid NOT NULL,
	"report_type" varchar(20) NOT NULL,
	"period" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"email_sent" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"level" varchar(100),
	"status" "study_plan_status" DEFAULT 'active' NOT NULL,
	"goals" jsonb,
	"schedule" jsonb,
	"weekly_hours_target" integer,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_plan_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"activities_completed" jsonb,
	"time_spent_minutes" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"topic" varchar(255) NOT NULL,
	"level" varchar(100),
	"mode" "tutor_mode" DEFAULT 'socratic' NOT NULL,
	"misconceptions" jsonb,
	"concepts_mastered" jsonb,
	"session_stats" jsonb,
	"status" "tutor_session_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weakness_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic_id" uuid,
	"subject" varchar(100) NOT NULL,
	"weakness_score" integer NOT NULL,
	"evidence_data" jsonb,
	"last_assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_grade" ADD CONSTRAINT "ai_grade_submission_id_ai_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."ai_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_grade" ADD CONSTRAINT "ai_grade_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_quality_check" ADD CONSTRAINT "ai_quality_check_submission_id_ai_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."ai_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_submission" ADD CONSTRAINT "ai_submission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_submission" ADD CONSTRAINT "ai_submission_exam_id_ai_exam_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."ai_exam"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_submission" ADD CONSTRAINT "ai_submission_assignment_id_ai_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."ai_assignment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_import" ADD CONSTRAINT "curriculum_import_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_import" ADD CONSTRAINT "curriculum_import_source_resource_id_resource_id_fk" FOREIGN KEY ("source_resource_id") REFERENCES "public"."resource"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD CONSTRAINT "flashcard_review_flashcard_set_id_ai_flashcard_id_fk" FOREIGN KEY ("flashcard_set_id") REFERENCES "public"."ai_flashcard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_review" ADD CONSTRAINT "flashcard_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_report" ADD CONSTRAINT "parent_report_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_report" ADD CONSTRAINT "parent_report_generated_by_user_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plan" ADD CONSTRAINT "study_plan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plan_progress" ADD CONSTRAINT "study_plan_progress_plan_id_study_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plan_progress" ADD CONSTRAINT "study_plan_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_session" ADD CONSTRAINT "tutor_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_session" ADD CONSTRAINT "tutor_session_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weakness_profile" ADD CONSTRAINT "weakness_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weakness_profile" ADD CONSTRAINT "weakness_profile_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_submission_user_status_idx" ON "ai_submission" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ai_submission_exam_idx" ON "ai_submission" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "ai_submission_assignment_idx" ON "ai_submission" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "fr_user_next_review_idx" ON "flashcard_review" USING btree ("user_id","next_review_date");--> statement-breakpoint
CREATE INDEX "wp_user_weakness_idx" ON "weakness_profile" USING btree ("user_id","weakness_score");