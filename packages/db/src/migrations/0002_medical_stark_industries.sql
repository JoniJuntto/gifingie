CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."submission_source" AS ENUM('giphy', 'upload');--> statement-breakpoint
ALTER TABLE "gif_submissions" ALTER COLUMN "giphy_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "gif_submissions" ALTER COLUMN "gif_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD COLUMN "source" "submission_source" DEFAULT 'giphy' NOT NULL;--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD COLUMN "moderation_status" "moderation_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD COLUMN "s3_key" text;--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD COLUMN "byte_size" integer;--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD COLUMN "original_filename" text;--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD COLUMN "uploaded_at" timestamp;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "moderate_giphy_submissions" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "gif_submissions_moderation_idx" ON "gif_submissions" USING btree ("streamer_profile_id","moderation_status","uploaded_at");