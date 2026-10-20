/*
 * Misskey v12 standalone frontend build.
 *
 * Usage: node scripts/build-standalone.mjs
 *
 * Output: built/_standalone_/
 * Vite emits under /assets/ because packages/client/vite.config.ts sets base to /assets/.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import locales from '../locales/index.js';
import meta from '../package.json' assert { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'built/_standalone_');
const viteOutDir = path.resolve(rootDir, 'built/_client_dist_');

const DEFAULT_INSTANCE_URL = 'https://submarin.online';

function run(command) {
	execSync(command, {
		cwd: rootDir,
		stdio: 'inherit',
		env: { ...process.env, NODE_ENV: 'production' },
	});
}

async function clean() {
	console.log('[standalone] Cleaning output directories...');
	await fs.rm(outDir, { recursive: true, force: true });
	await fs.rm(viteOutDir, { recursive: true, force: true });
	await fs.mkdir(outDir, { recursive: true });
}

async function buildFrontend() {
	console.log('[standalone] Building client with Vite...');
	run('pnpm --filter client build');
}

async function copyViteOutput() {
	console.log('[standalone] Copying Vite output to /assets/...');
	await fs.cp(viteOutDir, path.resolve(outDir, 'assets'), { recursive: true });
}

async function copyLocales() {
	console.log('[standalone] Writing locales...');
	const localeDir = path.resolve(outDir, 'assets/locales');
	await fs.mkdir(localeDir, { recursive: true });
	const versionStamp = { _version_: meta.version };
	for (const [lang, locale] of Object.entries(locales)) {
		await fs.writeFile(
			path.resolve(localeDir, `${lang}.${meta.version}.json`),
			JSON.stringify({ ...locale, ...versionStamp }),
			'utf-8',
		);
	}
}

async function copyOptional(from, to, label) {
	try {
		await fs.cp(from, to, { recursive: true, dereference: true });
	} catch (err) {
		console.warn(`[standalone] Warning: could not copy ${label}: ${err.message}`);
	}
}

async function copyStaticAssets() {
	console.log('[standalone] Copying static assets...');
	await copyOptional(
		path.resolve(rootDir, 'packages/client/assets'),
		path.resolve(outDir, 'client-assets'),
		'client assets',
	);
	await copyOptional(
		path.resolve(rootDir, 'packages/backend/assets'),
		path.resolve(outDir, 'static-assets'),
		'backend assets',
	);
	await copyOptional(
		path.resolve(rootDir, 'packages/client/node_modules/@tabler/icons-webfont'),
		path.resolve(outDir, 'assets/tabler-icons'),
		'tabler icons',
	);
	await copyOptional(
		path.resolve(rootDir, 'packages/client/node_modules/three/examples/fonts'),
		path.resolve(outDir, 'assets/fonts'),
		'three fonts',
	);
	await copyOptional(
		path.resolve(rootDir, 'packages/client/node_modules/@discordapp/twemoji/dist/svg'),
		path.resolve(outDir, 'twemoji'),
		'twemoji',
	);

	try {
		await fs.copyFile(
			path.resolve(rootDir, 'packages/backend/assets/favicon.ico'),
			path.resolve(outDir, 'favicon.ico'),
		);
	} catch {
		console.warn('[standalone] Warning: favicon.ico was not copied');
	}

	const tablerCss = path.resolve(outDir, 'assets/tabler-icons/tabler-icons.min.css');
	const tablerFont = path.resolve(outDir, 'assets/tabler-icons/fonts/tabler-icons.woff2');
	const tablerCssStat = await fs.lstat(tablerCss);
	const tablerFontStat = await fs.lstat(tablerFont);
	if (!tablerCssStat.isFile() || !tablerFontStat.isFile()) {
		throw new Error('tabler icons were copied as a link instead of real files');
	}
}

async function generateIndexHtml() {
	console.log('[standalone] Generating index.html...');
	const manifestPath = path.resolve(viteOutDir, 'manifest.json');
	const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
	const entry = Object.values(manifest).find(item => item && item.isEntry && typeof item.file === 'string' && item.file.endsWith('.js'));
	if (!entry) {
		throw new Error('Could not find the JS entry in Vite manifest');
	}

	const cssLinks = (entry.css || [])
		.map(href => `\t<link rel="stylesheet" href="/assets/${href}">`)
		.join('\n');

	const boot = await fs.readFile(path.resolve(__dirname, 'standalone-boot.js'), 'utf-8');
	const langs = JSON.stringify(Object.keys(locales));

	const html = `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="application-name" content="Misskey">
	<meta name="referrer" content="origin">
	<meta name="theme-color" content="#86b300">
	<meta name="theme-color-orig" content="#86b300">
	<meta name="misskey-standalone" content="true">
	<meta property="og:site_name" content="Misskey">
	<meta property="instance_url" content="${DEFAULT_INSTANCE_URL}">
	<link rel="icon" href="/favicon.ico">
	<link rel="stylesheet" href="/assets/tabler-icons/tabler-icons.min.css">
	<link rel="modulepreload" href="/assets/${entry.file}">
${cssLinks}
	<title>Submarin v12</title>
	<meta name="description" content="Submarin v12">
	<style>
		html { background-color: var(--bg, #1a1a1a); color: var(--fg, #f0f0f0); }
		#splash { position: fixed; z-index: 10000; top: 0; left: 0; width: 100vw; height: 100vh; cursor: wait; background-color: var(--bg, #1a1a1a); }
		#splashIcon { position: absolute; top: 0; right: 0; bottom: 0; left: 0; margin: auto; width: 64px; height: 64px; pointer-events: none; }
		#splashSpinner { position: absolute; top: 0; right: 0; bottom: 0; left: 0; margin: auto; display: inline-block; width: 28px; height: 28px; transform: translateY(70px); color: var(--accent, #86b300); }
		#splashSpinner > .spinner { position: absolute; top: 0; left: 0; width: 28px; height: 28px; fill-rule: evenodd; clip-rule: evenodd; stroke-linecap: round; stroke-linejoin: round; stroke-miterlimit: 1.5; }
		#splashSpinner > .spinner.bg { opacity: 0.275; }
		#splashSpinner > .spinner.fg { animation: splashSpinner 0.5s linear infinite; }
		@keyframes splashSpinner { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
	</style>
	<script>
		var VERSION = ${JSON.stringify(meta.version)};
		var CLIENT_ENTRY = ${JSON.stringify(entry.file)};
		var LANGS = ${langs};
	</script>
	<script>
${boot}
	</script>
</head>
<body>
	<noscript><p>JavaScriptを有効にしてください<br>Please turn on your JavaScript</p></noscript>
	<div id="splash">
		<img id="splashIcon" src="/static-assets/splash.png" alt="">
		<div id="splashSpinner">
			<svg class="spinner bg" viewBox="0 0 152 152" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1,0,0,1,12,12)"><circle cx="64" cy="64" r="64" style="fill:none;stroke:currentColor;stroke-width:24px;"/></g></svg>
			<svg class="spinner fg" viewBox="0 0 152 152" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1,0,0,1,12,12)"><path d="M128,64C128,28.654 99.346,0 64,0C99.346,0 128,28.654 128,64Z" style="fill:none;stroke:currentColor;stroke-width:24px;"/></g></svg>
		</div>
	</div>
</body>
</html>
`;

	await fs.writeFile(path.resolve(outDir, 'index.html'), html, 'utf-8');
}

async function generateHtaccess() {
	const htaccess = `# Misskey v12 standalone frontend
<IfModule mod_rewrite.c>
	RewriteEngine On
	RewriteBase /

	RewriteCond %{REQUEST_FILENAME} -f [OR]
	RewriteCond %{REQUEST_FILENAME} -d
	RewriteRule ^ - [L]

	RewriteRule ^ index.html [L]
</IfModule>

<IfModule mod_expires.c>
	ExpiresActive On
	ExpiresByType text/css "access plus 30 days"
	ExpiresByType application/javascript "access plus 30 days"
	ExpiresByType image/svg+xml "access plus 30 days"
</IfModule>
`;
	await fs.writeFile(path.resolve(outDir, '.htaccess'), htaccess, 'utf-8');
}

async function main() {
	const started = Date.now();
	console.log(`[standalone] Building ${meta.version}`);
	console.log(`[standalone] Default instance: ${DEFAULT_INSTANCE_URL}`);
	await clean();
	await buildFrontend();
	await copyViteOutput();
	await copyLocales();
	await copyStaticAssets();
	await generateIndexHtml();
	await generateHtaccess();
	console.log(`[standalone] Build complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
	console.log(`[standalone] Output: ${outDir}`);
}

main().catch(err => {
	console.error('[standalone] Build failed:', err);
	process.exit(1);
});
