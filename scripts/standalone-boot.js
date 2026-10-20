/**
 * 静的ホスト用ブート。
 * サーバーの version と比較してリロードしない。アセット版は常に VERSION。
 * LANGS / VERSION / CLIENT_ENTRY は index.html が先に定義する。
 */
'use strict';

(async () => {
	window.onerror = (e) => {
		console.error(e);
		renderError('SOMETHING_HAPPENED', e);
	};
	window.onunhandledrejection = (e) => {
		console.error(e);
		renderError('SOMETHING_HAPPENED_IN_PROMISE', e.reason || e);
	};

	const v = VERSION;

	const localeVersion = localStorage.getItem('localeVersion');
	const localeOutdated = (localeVersion == null || localeVersion !== v);

	if (!Object.prototype.hasOwnProperty.call(localStorage, 'locale') || localeOutdated) {
		const supportedLangs = LANGS;
		let lang = localStorage.getItem('lang');
		if (lang == null || !supportedLangs.includes(lang)) {
			if (supportedLangs.includes(navigator.language)) {
				lang = navigator.language;
			} else {
				lang = supportedLangs.find(x => x.split('-')[0] === navigator.language);
				if (lang == null) lang = 'en-US';
			}
		}

		const res = await fetch(`/assets/locales/${lang}.${v}.json`);
		if (res.status === 200) {
			localStorage.setItem('lang', lang);
			localStorage.setItem('locale', await res.text());
			localStorage.setItem('localeVersion', v);
		} else {
			renderError('LOCALE_FETCH');
			return;
		}
	}

	function importAppScript() {
		import(`/assets/${CLIENT_ENTRY}`)
			.catch(e => {
				console.error(e);
				renderError('APP_IMPORT', e);
			});
	}

	if (document.readyState !== 'loading') {
		importAppScript();
	} else {
		window.addEventListener('DOMContentLoaded', () => {
			importAppScript();
		});
	}

	const theme = localStorage.getItem('theme');
	if (theme) {
		for (const [k, value] of Object.entries(JSON.parse(theme))) {
			document.documentElement.style.setProperty(`--${k}`, value.toString());
			if (k === 'htmlThemeColor') {
				for (const tag of document.head.children) {
					if (tag.tagName === 'META' && tag.getAttribute('name') === 'theme-color') {
						tag.setAttribute('content', value);
						break;
					}
				}
			}
		}
	}

	const colorSchema = localStorage.getItem('colorSchema');
	if (colorSchema) {
		document.documentElement.style.setProperty('color-schema', colorSchema);
	}

	const fontSize = localStorage.getItem('fontSize');
	if (fontSize) {
		document.documentElement.classList.add('f-' + fontSize);
	}

	const useSystemFont = localStorage.getItem('useSystemFont');
	if (useSystemFont) {
		document.documentElement.classList.add('useSystemFont');
	}

	const wallpaper = localStorage.getItem('wallpaper');
	if (wallpaper) {
		document.documentElement.style.backgroundImage = `url(${wallpaper})`;
	}

	const customCss = localStorage.getItem('customCss');
	if (customCss && customCss.length > 0) {
		const style = document.createElement('style');
		style.innerHTML = customCss;
		document.head.appendChild(style);
	}

	function renderError(code, details) {
		document.body.innerHTML = `
			<h1>An error has occurred</h1>
			<p>${code}</p>
			<pre></pre>
			<button type="button" onclick="location.reload()">Refresh</button>
		`;
		document.body.querySelector('pre').textContent = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
	}
})();
