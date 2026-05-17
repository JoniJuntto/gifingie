import { relations } from "drizzle-orm";
import {
	bigserial,
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const selectedRoleEnum = pgEnum("selected_role", ["streamer", "viewer"]);
export const submissionSourceEnum = pgEnum("submission_source", [
	"giphy",
	"upload",
	"sound",
]);
export const moderationStatusEnum = pgEnum("moderation_status", [
	"pending",
	"approved",
	"rejected",
]);
export const viewerAccessEnum = pgEnum("viewer_access", [
	"everyone",
	"followers",
	"subscribers",
]);
export const priceCurrencyEnum = pgEnum("price_currency", [
	"none",
	"channel_points",
	"bits",
]);
export const paymentCreditKindEnum = pgEnum("payment_credit_kind", [
	"channel_points",
	"bits",
]);
export const paymentCreditStatusEnum = pgEnum("payment_credit_status", [
	"available",
	"consumed",
	"expired",
]);

export const userPreferences = pgTable("user_preferences", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	selectedRole: selectedRoleEnum("selected_role"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const streamerProfiles = pgTable(
	"streamer_profiles",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		twitchChannelId: text("twitch_channel_id").notNull(),
		twitchChannelLogin: text("twitch_channel_login").notNull(),
		twitchDisplayName: text("twitch_display_name").notNull(),
		twitchAvatarUrl: text("twitch_avatar_url"),
		isEnrolled: boolean("is_enrolled").default(true).notNull(),
		overlayToken: text("overlay_token").notNull(),
		gifDisplaySeconds: integer("gif_display_seconds").default(10).notNull(),
		overlayGifXPercent: integer("overlay_gif_x_percent").default(50).notNull(),
		overlayGifYPercent: integer("overlay_gif_y_percent").default(78).notNull(),
		overlayGifWidthPercent: integer("overlay_gif_width_percent")
			.default(28)
			.notNull(),
		overlayGifHeightPercent: integer("overlay_gif_height_percent")
			.default(22)
			.notNull(),
		shareVisitCount: integer("share_visit_count").default(0).notNull(),
		moderateGiphySubmissions: boolean("moderate_giphy_submissions")
			.default(false)
			.notNull(),
		allowCustomUploads: boolean("allow_custom_uploads")
			.default(false)
			.notNull(),
		allowGifSubmissions: boolean("allow_gif_submissions")
			.default(true)
			.notNull(),
		allowSoundSubmissions: boolean("allow_sound_submissions")
			.default(true)
			.notNull(),
		giphyAccess: viewerAccessEnum("giphy_access").default("everyone").notNull(),
		uploadAccess: viewerAccessEnum("upload_access").default("everyone").notNull(),
		giphyPriceCurrency: priceCurrencyEnum("giphy_price_currency")
			.default("none")
			.notNull(),
		giphyPriceAmount: integer("giphy_price_amount"),
		uploadPriceCurrency: priceCurrencyEnum("upload_price_currency")
			.default("none")
			.notNull(),
		uploadPriceAmount: integer("upload_price_amount"),
		giphyChannelPointsRewardId: text("giphy_channel_points_reward_id"),
		uploadChannelPointsRewardId: text("upload_channel_points_reward_id"),
		soundPriceCurrency: priceCurrencyEnum("sound_price_currency")
			.default("none")
			.notNull(),
		soundPriceAmount: integer("sound_price_amount"),
		soundChannelPointsRewardId: text("sound_channel_points_reward_id"),
		liveCheckedAt: timestamp("live_checked_at"),
		isLive: boolean("is_live").default(false).notNull(),
		liveStreamTitle: text("live_stream_title"),
		liveStreamThumbnailUrl: text("live_stream_thumbnail_url"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("streamer_profiles_user_id_idx").on(table.userId),
		uniqueIndex("streamer_profiles_overlay_token_idx").on(table.overlayToken),
		index("streamer_profiles_twitch_channel_id_idx").on(table.twitchChannelId),
	],
);

export const gifSubmissions = pgTable(
	"gif_submissions",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		streamerProfileId: uuid("streamer_profile_id")
			.notNull()
			.references(() => streamerProfiles.id, { onDelete: "cascade" }),
		viewerUserId: text("viewer_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		viewerTwitchId: text("viewer_twitch_id"),
		extensionTransactionId: text("extension_transaction_id"),
		source: submissionSourceEnum("source").default("giphy").notNull(),
		moderationStatus: moderationStatusEnum("moderation_status")
			.default("approved")
			.notNull(),
		giphyId: text("giphy_id"),
		gifUrl: text("gif_url"),
		previewUrl: text("preview_url"),
		title: text("title").notNull(),
		caption: text("caption"),
		s3Key: text("s3_key"),
		contentType: text("content_type"),
		byteSize: integer("byte_size"),
		originalFilename: text("original_filename"),
		uploadedAt: timestamp("uploaded_at"),
		durationMs: integer("duration_ms"),
		displayedAt: timestamp("displayed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("gif_submissions_streamer_poll_idx").on(
			table.streamerProfileId,
			table.id,
		),
		index("gif_submissions_viewer_rate_idx").on(
			table.streamerProfileId,
			table.viewerUserId,
			table.createdAt,
		),
		index("gif_submissions_twitch_rate_idx").on(
			table.streamerProfileId,
			table.viewerTwitchId,
			table.createdAt,
		),
		index("gif_submissions_duplicate_idx").on(
			table.streamerProfileId,
			table.giphyId,
			table.createdAt,
		),
		index("gif_submissions_displayed_idx").on(
			table.streamerProfileId,
			table.displayedAt,
		),
		index("gif_submissions_moderation_idx").on(
			table.streamerProfileId,
			table.moderationStatus,
			table.uploadedAt,
		),
		uniqueIndex("gif_submissions_extension_tx_idx").on(
			table.extensionTransactionId,
		),
	],
);

export const paymentCredits = pgTable(
	"payment_credits",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		streamerProfileId: uuid("streamer_profile_id")
			.notNull()
			.references(() => streamerProfiles.id, { onDelete: "cascade" }),
		viewerTwitchId: text("viewer_twitch_id").notNull(),
		viewerUserId: text("viewer_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		kind: paymentCreditKindEnum("kind").notNull(),
		amount: integer("amount").notNull(),
		externalId: text("external_id").notNull(),
		channelPointsRewardId: text("channel_points_reward_id"),
		status: paymentCreditStatusEnum("status").default("available").notNull(),
		consumedSubmissionId: integer("consumed_submission_id").references(
			() => gifSubmissions.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		expiresAt: timestamp("expires_at").notNull(),
	},
	(table) => [
		uniqueIndex("payment_credits_external_id_idx").on(table.externalId),
		index("payment_credits_viewer_available_idx").on(
			table.streamerProfileId,
			table.viewerTwitchId,
			table.status,
			table.expiresAt,
		),
	],
);

export const userPreferencesRelations = relations(
	userPreferences,
	({ one }) => ({
		user: one(user, {
			fields: [userPreferences.userId],
			references: [user.id],
		}),
	}),
);

export const streamerProfilesRelations = relations(
	streamerProfiles,
	({ one, many }) => ({
		user: one(user, {
			fields: [streamerProfiles.userId],
			references: [user.id],
		}),
		submissions: many(gifSubmissions),
		paymentCredits: many(paymentCredits),
	}),
);

export const paymentCreditsRelations = relations(paymentCredits, ({ one }) => ({
	streamer: one(streamerProfiles, {
		fields: [paymentCredits.streamerProfileId],
		references: [streamerProfiles.id],
	}),
	viewer: one(user, {
		fields: [paymentCredits.viewerUserId],
		references: [user.id],
	}),
	consumedSubmission: one(gifSubmissions, {
		fields: [paymentCredits.consumedSubmissionId],
		references: [gifSubmissions.id],
	}),
}));

export const gifSubmissionsRelations = relations(gifSubmissions, ({ one }) => ({
	streamer: one(streamerProfiles, {
		fields: [gifSubmissions.streamerProfileId],
		references: [streamerProfiles.id],
	}),
	viewer: one(user, {
		fields: [gifSubmissions.viewerUserId],
		references: [user.id],
	}),
}));
