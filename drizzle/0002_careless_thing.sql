CREATE TYPE "public"."dossier_decision" AS ENUM('accepted', 'rejected');--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "summary" jsonb;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "client_name" text;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "decision" "dossier_decision";--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "decision_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "archived_at" timestamp with time zone;