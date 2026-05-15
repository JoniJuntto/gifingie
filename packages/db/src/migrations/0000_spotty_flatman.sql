CREATE TYPE "public"."selected_role" AS ENUM('streamer', 'viewer');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gif_submissions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"streamer_profile_id" uuid NOT NULL,
	"viewer_user_id" text NOT NULL,
	"giphy_id" text NOT NULL,
	"gif_url" text NOT NULL,
	"preview_url" text,
	"title" text NOT NULL,
	"displayed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streamer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"twitch_channel_id" text NOT NULL,
	"twitch_channel_login" text NOT NULL,
	"twitch_display_name" text NOT NULL,
	"twitch_avatar_url" text,
	"is_enrolled" boolean DEFAULT true NOT NULL,
	"overlay_token" text NOT NULL,
	"live_checked_at" timestamp,
	"is_live" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"selected_role" "selected_role",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD CONSTRAINT "gif_submissions_streamer_profile_id_streamer_profiles_id_fk" FOREIGN KEY ("streamer_profile_id") REFERENCES "public"."streamer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD CONSTRAINT "gif_submissions_viewer_user_id_user_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD CONSTRAINT "streamer_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "gif_submissions_streamer_poll_idx" ON "gif_submissions" USING btree ("streamer_profile_id","id");--> statement-breakpoint
CREATE INDEX "gif_submissions_viewer_rate_idx" ON "gif_submissions" USING btree ("streamer_profile_id","viewer_user_id","created_at");--> statement-breakpoint
CREATE INDEX "gif_submissions_duplicate_idx" ON "gif_submissions" USING btree ("streamer_profile_id","giphy_id","created_at");--> statement-breakpoint
CREATE INDEX "gif_submissions_displayed_idx" ON "gif_submissions" USING btree ("streamer_profile_id","displayed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "streamer_profiles_user_id_idx" ON "streamer_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "streamer_profiles_overlay_token_idx" ON "streamer_profiles" USING btree ("overlay_token");--> statement-breakpoint
CREATE INDEX "streamer_profiles_twitch_channel_id_idx" ON "streamer_profiles" USING btree ("twitch_channel_id");