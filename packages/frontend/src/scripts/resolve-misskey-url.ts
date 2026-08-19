/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { apiUrl } from '@@/js/config.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shouldNormalizeUrlValue(key: string, value: unknown): value is string {
	if (typeof value !== 'string' || value === '') return false;
	if (key === 'emojis' || key === 'reactionEmojis') return false;
	return key === 'url' || key.endsWith('Url');
}

function getRuntimeApiBaseUrl(): string {
	const standaloneHost = window.localStorage.getItem('standaloneHost');
	if (standaloneHost != null && standaloneHost !== '') {
		return `https://${standaloneHost.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
	}

	const instanceMeta = document.querySelector<HTMLMetaElement>('meta[property="instance_url"]');
	if (instanceMeta?.content) {
		return instanceMeta.content;
	}

	return apiUrl;
}

export function getRuntimeMisskeyAssetOrigin(): string {
	return new URL(getRuntimeApiBaseUrl(), window.location.href).origin;
}

export function getRuntimeMisskeyHost(): string | null {
	try {
		return new URL(getRuntimeApiBaseUrl(), window.location.href).host || null;
	} catch {
		return null;
	}
}

export function resolveMisskeyAssetUrl(url: string): string {
	if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
		return url;
	}

	return new URL(url, `${getRuntimeMisskeyAssetOrigin()}/`).toString();
}

export function normalizeMisskeyUrls<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map(item => normalizeMisskeyUrls(item)) as T;
	}

	if (!isPlainObject(value)) {
		return value;
	}

	const normalizedEntries = Object.entries(value).map(([key, entryValue]) => {
		if ((key === 'emojis' || key === 'reactionEmojis') && isPlainObject(entryValue)) {
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