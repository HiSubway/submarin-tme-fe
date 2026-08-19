/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Locale } from '../../../locales/index.js';

const standaloneHost = localStorage.getItem('standaloneHost');
const resolvedInstanceUrl = standaloneHost != null && standaloneHost !== ''
	? `https://${standaloneHost.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`
	: document.querySelector<HTMLMetaElement>('meta[property="instance_url"]')?.content || location.href;

// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
const address = new URL(resolvedInstanceUrl);
const siteName = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content;
export const isStandalone = document.querySelector<HTMLMetaElement>('meta[name="misskey-standalone"]')?.content === 'true';

export const host = address.host;
export const hostname = address.hostname;
export const url = address.origin;
export const apiUrl = address.origin + '/api';
export const urlPreviewUrl = 'https://hisubway.online/articles/preview/';
export const wsOrigin = address.origin;
export const lang = localStorage.getItem('lang') ?? 'en-US';
export const langs = _LANGS_;
const preParseLocale = localStorage.getItem('locale');
function parseStoredLocale(rawLocale: string | null): Locale {
	if (rawLocale == null) return null;

	try {
		return JSON.parse(rawLocale) as Locale;
	} catch {
		localStorage.removeItem('locale');
		localStorage.removeItem('localeVersion');
		return null;
	}
}

export let locale: Locale = parseStoredLocale(preParseLocale);
export const version = _VERSION_;
export const commitHash = _COMMIT_HASH_;
export const instanceName = (siteName === 'Misskey' || siteName == null) ? host : siteName;
export const ui = localStorage.getItem('ui');
export const debug = localStorage.getItem('debug') === 'true';

export function updateLocale(newLocale: Locale): void {
	locale = newLocale;
}
