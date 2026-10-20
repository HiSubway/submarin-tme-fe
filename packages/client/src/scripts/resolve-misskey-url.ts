import { url as instanceOrigin } from '@/config';

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shouldNormalizeUrlValue(key: string, value: unknown): value is string {
	if (typeof value !== 'string' || value === '') return false;
	if (key === 'emojis' || key === 'reactionEmojis') return false;
	return key === 'url' || key.endsWith('Url');
}

export function toCustomEmojiList(value: unknown): { name: string; url: string; aliases: string[] }[] {
	if (Array.isArray(value)) {
		return value.flatMap(emoji => {
			if (!isPlainObject(emoji) || typeof emoji.name !== 'string' || typeof emoji.url !== 'string' || emoji.url === '') return [];
			return [{
				name: emoji.name,
				url: resolveMisskeyAssetUrl(emoji.url),
				aliases: Array.isArray(emoji.aliases) ? emoji.aliases.filter((alias): alias is string => typeof alias === 'string') : [],
			}];
		});
	}

	if (!isPlainObject(value)) return [];

	return Object.entries(value).flatMap(([name, emojiUrl]) => {
		if (typeof emojiUrl !== 'string' || emojiUrl === '') return [];
		return [{
			name,
			url: resolveMisskeyAssetUrl(emojiUrl),
			aliases: [],
		}];
	});
}

export function customEmojisForReaction(note: { emojis?: unknown; reactionEmojis?: unknown } | null | undefined): { name: string; url: string; aliases: string[] }[] {
	const merged = new Map<string, { name: string; url: string; aliases: string[] }>();
	for (const emoji of [
		...toCustomEmojiList(note?.emojis),
		...toCustomEmojiList(note?.reactionEmojis),
	]) {
		merged.set(emoji.name, emoji);
	}
	return [...merged.values()];
}

export function resolveMisskeyAssetUrl(assetUrl: string): string {
	if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(assetUrl) || assetUrl.startsWith('data:') || assetUrl.startsWith('blob:')) {
		return assetUrl;
	}

	return new URL(assetUrl, `${instanceOrigin}/`).toString();
}

export function normalizeMisskeyUrls<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map(item => normalizeMisskeyUrls(item)) as T;
	}

	if (!isPlainObject(value)) {
		return value;
	}

	const normalizedEntries = Object.entries(value).map(([key, entryValue]) => {
		if (key === 'emojis' && isPlainObject(entryValue)) {
			const values = Object.values(entryValue);
			if (values.every(emojiUrl => typeof emojiUrl === 'string')) {
				return [key, toCustomEmojiList(entryValue)];
			}
		}

		if (key === 'reactionEmojis' && isPlainObject(entryValue)) {
			return [key, Object.fromEntries(
				Object.entries(entryValue).map(([emojiName, emojiUrl]) => [
					emojiName,
					typeof emojiUrl === 'string' ? resolveMisskeyAssetUrl(emojiUrl) : emojiUrl,
				]),
			)];
		}

		if (shouldNormalizeUrlValue(key, entryValue)) {
			return [key, resolveMisskeyAssetUrl(entryValue)];
		}

		return [key, normalizeMisskeyUrls(entryValue)];
	});

	return Object.fromEntries(normalizedEntries) as T;
}
