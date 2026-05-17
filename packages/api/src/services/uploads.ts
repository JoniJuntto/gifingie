import { randomUUID } from "node:crypto";
import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@my-better-t-app/env/server";

import {
	ALLOWED_SOUND_CONTENT_TYPES,
	ALLOWED_UPLOAD_CONTENT_TYPES,
	MAX_SOUND_BYTES,
	MAX_UPLOAD_BYTES,
} from "./constants";

type ImageUploadContentType = (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number];
type SoundUploadContentType = (typeof ALLOWED_SOUND_CONTENT_TYPES)[number];

let s3Client: S3Client | null = null;

function getS3Config() {
	const endpoint = env.S3_ENDPOINT;
	const region = env.S3_REGION;
	const bucket = env.S3_BUCKET;
	const accessKeyId = env.S3_ACCESS_KEY_ID;
	const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
	const missing = [
		["S3_ENDPOINT", endpoint],
		["S3_REGION", region],
		["S3_BUCKET", bucket],
		["S3_ACCESS_KEY_ID", accessKeyId],
		["S3_SECRET_ACCESS_KEY", secretAccessKey],
	].filter(([, value]) => !value);

	if (missing.length > 0) {
		throw new Error(
			`Missing S3 upload configuration: ${missing
				.map(([name]) => name)
				.join(", ")}`,
		);
	}

	return {
		endpoint: endpoint as string,
		region: region as string,
		bucket: bucket as string,
		accessKeyId: accessKeyId as string,
		secretAccessKey: secretAccessKey as string,
	};
}

function getS3Client() {
	if (s3Client) {
		return s3Client;
	}

	const config = getS3Config();
	s3Client = new S3Client({
		endpoint: config.endpoint,
		region: config.region,
		forcePathStyle: true,
		credentials: {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
		},
	});

	return s3Client;
}

export function isAllowedImageUploadContentType(
	contentType: string,
): contentType is ImageUploadContentType {
	return ALLOWED_UPLOAD_CONTENT_TYPES.includes(
		contentType as ImageUploadContentType,
	);
}

export function isAllowedSoundUploadContentType(
	contentType: string,
): contentType is SoundUploadContentType {
	return ALLOWED_SOUND_CONTENT_TYPES.includes(
		contentType as SoundUploadContentType,
	);
}

/** @deprecated Use validateImageUploadMetadata */
export function isAllowedUploadContentType(
	contentType: string,
): contentType is ImageUploadContentType {
	return isAllowedImageUploadContentType(contentType);
}

export function validateImageUploadMetadata(input: {
	contentType: string;
	byteSize: number;
}) {
	if (!isAllowedImageUploadContentType(input.contentType)) {
		return "Unsupported image type.";
	}

	if (
		!Number.isSafeInteger(input.byteSize) ||
		input.byteSize <= 0 ||
		input.byteSize > MAX_UPLOAD_BYTES
	) {
		return "Upload must be an image or GIF up to 10 MB.";
	}

	return null;
}

export function validateSoundUploadMetadata(input: {
	contentType: string;
	byteSize: number;
}) {
	if (!isAllowedSoundUploadContentType(input.contentType)) {
		return "Unsupported audio type.";
	}

	if (
		!Number.isSafeInteger(input.byteSize) ||
		input.byteSize <= 0 ||
		input.byteSize > MAX_SOUND_BYTES
	) {
		return "Upload must be an audio file up to 5 MB.";
	}

	return null;
}

/** @deprecated Use validateImageUploadMetadata */
export function validateUploadMetadata(input: {
	contentType: string;
	byteSize: number;
}) {
	return validateImageUploadMetadata(input);
}

export function createUploadObjectKey(input: {
	streamerProfileId: string;
	submissionId: number;
	originalFilename?: string | null;
}) {
	const extension = input.originalFilename?.split(".").pop()?.toLowerCase();
	const safeExtension =
		extension && /^[a-z0-9]{1,8}$/.test(extension) ? `.${extension}` : "";

	return `streamers/${input.streamerProfileId}/submissions/${input.submissionId}/${randomUUID()}${safeExtension}`;
}

export async function createSignedUploadUrl(input: {
	key: string;
	contentType: string;
	byteSize: number;
}) {
	const config = getS3Config();
	const command = new PutObjectCommand({
		Bucket: config.bucket,
		Key: input.key,
		ContentLength: input.byteSize,
		ContentType: input.contentType,
	});

	return getSignedUrl(getS3Client(), command, {
		expiresIn: env.S3_UPLOAD_URL_TTL_SECONDS,
	});
}

export async function createSignedDisplayUrl(key: string) {
	const config = getS3Config();
	const command = new GetObjectCommand({
		Bucket: config.bucket,
		Key: key,
	});

	return getSignedUrl(getS3Client(), command, {
		expiresIn: env.S3_DISPLAY_URL_TTL_SECONDS,
	});
}
