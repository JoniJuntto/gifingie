ALTER TABLE "gif_submissions" ADD COLUMN "caption" text;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "share_visit_count" integer DEFAULT 0 NOT NULL;