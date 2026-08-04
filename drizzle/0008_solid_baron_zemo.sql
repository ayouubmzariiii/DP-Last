CREATE TABLE "beta_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nom" text,
	"phone" text,
	"profil" text DEFAULT 'particulier' NOT NULL,
	"metier" text,
	"travaux" text,
	"commune" text,
	"code_postal" text,
	"message" text,
	"source" text,
	"campaign" text,
	"referrer" text,
	"status" text DEFAULT 'nouveau' NOT NULL,
	"notes" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "beta_signups_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"anon_id" text,
	"user_id" uuid,
	"path" text,
	"referrer" text,
	"source" text,
	"campaign" text,
	"props" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"dossier_id" uuid,
	"category" text DEFAULT 'autre' NOT NULL,
	"rating" integer,
	"message" text NOT NULL,
	"email" text,
	"path" text,
	"step" integer,
	"user_agent" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "beta_signups" ADD CONSTRAINT "beta_signups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "beta_signups_status_idx" ON "beta_signups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "beta_signups_created_idx" ON "beta_signups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_name_created_idx" ON "events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "events_path_idx" ON "events" USING btree ("path");--> statement-breakpoint
CREATE INDEX "events_anon_idx" ON "events" USING btree ("anon_id");--> statement-breakpoint
CREATE INDEX "feedback_created_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_resolved_idx" ON "feedback" USING btree ("resolved");