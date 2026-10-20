import { I18nObject } from '@/i18n';
import { parseObject } from '@/scripts/tms/parse';

const DEFAULT_INSTANCE_ORIGIN = 'https://submarin.online';

function resolveInstanceOrigin(): string {
	try {
		const standaloneHost = localStorage.getItem('standaloneHost');
		if (standaloneHost != null && standaloneHost !== '') {
			const host = standaloneHost.replace(/^https?:\/\//, '').replace(/\/+$/, '');
			return `https://${host}`;
		}
	} catch {
		// localStorage が使えない場合は meta か既定値へ落とす
	}

	const fromMeta = document.querySelector<HTMLMetaElement>('meta[property="instance_url"]')?.content;
	if (fromMeta) {
		try {
			return new URL(fromMeta).origin;
		} catch {
			// 不正な meta は既定値へ落とす
		}
	}

	return DEFAULT_INSTANCE_ORIGIN;
}

const address = new URL(resolveInstanceOrigin());
const siteName = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content;

export const isStandalone = document.querySelector<HTMLMetaElement>('meta[name="misskey-standalone"]')?.content === 'true';
export const host = address.host;
export const hostname = address.hostname;
export const url = address.origin;
export const apiUrl = url + '/api';
export const wsUrl = url.replace('http://', 'ws://').replace('https://', 'wss://') + '/streaming';
export const urlPreviewUrl = 'https://hisubway.online/articles/preview/';
export const lang = localStorage.getItem('lang');
export const langs = _LANGS_;
export let locale = parseObject<I18nObject>(localStorage.getItem('locale'));
export const version = _VERSION_;
export const instanceName = siteName === 'Misskey' ? host : siteName;
export const ui = localStorage.getItem('ui');
export const debug = localStorage.getItem('debug') === 'true';

export const updateLocale = (newLocale: I18nObject): void => {
	locale = newLocale;
};
