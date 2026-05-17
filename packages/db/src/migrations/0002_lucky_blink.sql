CREATE TYPE "public"."viewer_access" AS ENUM('everyone', 'followers', 'subscribers');--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "giphy_access" "viewer_access" DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "upload_access" "viewer_access" DEFAULT 'everyone' NOT NULL;