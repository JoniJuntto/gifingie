CREATE TYPE "public"."payment_credit_kind" AS ENUM('channel_points', 'bits');--> statement-breakpoint
CREATE TYPE "public"."payment_credit_status" AS ENUM('available', 'consumed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."price_currency" AS ENUM('none', 'channel_points', 'bits');--> statement-breakpoint
CREATE TABLE "payment_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"streamer_profile_id" uuid NOT NULL,
	"viewer_twitch_id" text NOT NULL,
	"viewer_user_id" text,
	"kind" "payment_credit_kind" NOT NULL,
	"amount" integer NOT NULL,
	"external_id" text NOT NULL,
	"channel_points_reward_id" text,
	"status" "payment_credit_status" DEFAULT 'available' NOT NULL,
	"consumed_submission_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "giphy_price_currency" "price_currency" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "giphy_price_amount" integer;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "upload_price_currency" "price_currency" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "upload_price_amount" integer;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "giphy_channel_points_reward_id" text;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "upload_channel_points_reward_id" text;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "sound_price_currency" "price_currency" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "sound_price_amount" integer;--> statement-breakpoint
ALTER TABLE "streamer_profiles" ADD COLUMN "sound_channel_points_reward_id" text;--> statement-breakpoint
ALTER TABLE "payment_credits" ADD CONSTRAINT "payment_credits_streamer_profile_id_streamer_profiles_id_fk" FOREIGN KEY ("streamer_profile_id") REFERENCES "public"."streamer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_credits" ADD CONSTRAINT "payment_credits_viewer_user_id_user_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_credits" ADD CONSTRAINT "payment_credits_consumed_submission_id_gif_submissions_id_fk" FOREIGN KEY ("consumed_submission_id") REFERENCES "public"."gif_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_credits_external_id_idx" ON "payment_credits" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "payment_credits_viewer_available_idx" ON "payment_credits" USING btree ("streamer_profile_id","viewer_twitch_id","status","expires_at");