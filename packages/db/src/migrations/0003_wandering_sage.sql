ALTER TYPE "public"."submission_source" ADD VALUE 'sound';--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "allow_gif_submissions" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "allow_sound_submissions" boolean DEFAULT true NOT NULL;