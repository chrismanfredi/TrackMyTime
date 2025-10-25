CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'denied', 'cancelled');--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(191) NOT NULL,
	"full_name" varchar(191) NOT NULL,
	"email" varchar(191) NOT NULL,
	"role" varchar(100) NOT NULL,
	"photo_url" text,
	"team" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "time_off_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actioned_by_clerk_user_id" varchar(191) NOT NULL,
	"actioned_by_name" varchar(191) NOT NULL,
	"action" "request_status" NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_off_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid,
	"clerk_user_id" varchar(191) NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"type" varchar(50) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"hours" integer,
	"note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
ALTER TABLE "time_off_approvals" ADD CONSTRAINT "time_off_approvals_request_id_time_off_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."time_off_requests"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "employees_clerk_user_id_idx" ON "employees" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "employees_email_idx" ON "employees" USING btree ("email");--> statement-breakpoint
CREATE INDEX "time_off_approvals_request_idx" ON "time_off_approvals" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "time_off_requests_status_idx" ON "time_off_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "time_off_requests_clerk_user_idx" ON "time_off_requests" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "time_off_requests_date_range_idx" ON "time_off_requests" USING btree ("start_date","end_date");