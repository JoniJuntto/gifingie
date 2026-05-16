export function buildTwitchThumbnailUrl(
	template: string,
	width: number,
	height: number,
) {
	return template
		.replaceAll("{width}", String(width))
		.replaceAll("{height}", String(height));
}
