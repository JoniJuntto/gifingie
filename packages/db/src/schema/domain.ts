import { relations } from "drizzle-orm";
import {
	bigserial,
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const selectedRoleEnum = pgEnum("selected_role", ["streamer", "viewer"]);

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
		liveCheckedAt: timestamp("live_checked_at"),
		isLive: boolean("is_live").default(false).notNull(),
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
		viewerUserId: text("viewer_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		giphyId: text("giphy_id").notNull(),
		gifUrl: text("gif_url").notNull(),
		previewUrl: text("preview_url"),
		title: text("title").notNull(),
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
		index("gif_submissions_duplicate_idx").on(
			table.streamerProfileId,
			table.giphyId,
			table.createdAt,
		),
		index("gif_submissions_displayed_idx").on(
			table.streamerProfileId,
			table.displayedAt,
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
	}),
);

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
