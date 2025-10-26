CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"hours" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "tasks_employee_id_idx" ON "tasks" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "tasks_start_date_idx" ON "tasks" USING btree ("start_date");