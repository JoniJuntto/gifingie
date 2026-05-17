ALTER TABLE "gif_submissions" DROP CONSTRAINT "gif_submissions_viewer_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "gif_submissions" ALTER COLUMN "viewer_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD COLUMN "viewer_twitch_id" text;--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD COLUMN "extension_transaction_id" text;--> statement-breakpoint
ALTER TABLE "gif_submissions" ADD CONSTRAINT "gif_submissions_viewer_user_id_user_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gif_submissions_twitch_rate_idx" ON "gif_submissions" USING btree ("streamer_profile_id","viewer_twitch_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "gif_submissions_extension_tx_idx" ON "gif_submissions" USING btree ("extension_transaction_id");