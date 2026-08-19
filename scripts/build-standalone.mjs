/*
 * Misskey Standalone Frontend Build Script
 *
 * Usage: node scripts/build-standalone.mjs
 *
 * This script builds the frontend for standalone static hosting.
 * The output is placed in built/_standalone_/ and can be served
 * from any static HTTP server (e.g., Apache).
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import { build as buildLocales } from '../locales/index.js';
import meta from '../package.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'built/_standalone_');
const viteOutDir = path.resolve(rootDir, 'built/_frontend_dist_standalone_');

const DEFAULT_INSTANCE_URL = 'https://submarin.online';

function runPnpm(command) {
	execSync(`pnpm --config.engine-strict=false ${command}`, {
		cwd: rootDir,
		stdio: 'inherit',
		env: { ...process.env, NODE_ENV: 'production' },
	});
}

async function clean() {
	console.log('[standalone] Cleaning output directory...');
	await fs.rm(outDir, { recursive: true, force: true });
	await fs.mkdir(outDir, { recursive: true });
}

async function buildFrontend() {
	console.log('[standalone] Building frontend with Vite...');
	runPnpm('--filter frontend exec vite build');
}

async function buildSharedDependencies() {
	console.log('[standalone] Building shared dependencies...');
	runPnpm('build-pre');

	// Build workspace packages consumed by the frontend.
	runPnpm('--filter misskey-js build');
	runPnpm('--filter misskey-reversi build');
	runPnpm('--filter misskey-bubble-game build');

	runPnpm('--filter frontend-shared build');
}

async function copyViteOutput() {
	console.log('[standalone] Copying Vite build output...');
	await fs.cp(viteOutDir, outDir, { recursive: true });
}

async function copyLocales() {
	console.log('[standalone] Building and copying locales...');
	const locales = buildLocales();
	const localeDir = path.resolve(outDir, 'assets/locales');
	await fs.mkdir(localeDir, { recursive: true });

	const v = { '_version_': meta.version };
	for (const [lang, locale] of Object.entries(locales)) {
		await fs.writeFile(
			path.resolve(localeDir, `${lang}.${meta.version}.json`),
			JSON.stringify({ ...locale, ...v }),
			'utf-8',
		);
	}
}

async function copyStaticAssets() {
	console.log('[standalone] Copying static assets...');
	// Copy splash icon from backend assets
	const clientAssetsDir = path.resolve(outDir, 'client-assets');
	const staticDir = path.resolve(outDir, 'static-assets');
	const twemojiDir = path.resolve(outDir, 'twemoji');
	await fs.mkdir(clientAssetsDir, { recursive: true });
	await fs.mkdir(staticDir, { recursive: true });
	await fs.mkdir(twemojiDir, { recursive: true });

	try {
		await fs.cp(
			path.resolve(rootDir, 'packages/frontend/assets'),
			clientAssetsDir,
			{ recursive: true },
		);
	} catch {
		console.warn('[standalone] Warning: Could not copy frontend client assets');
	}

	try {
		await fs.cp(
			path.resolve(rootDir, 'packages/backend/assets'),
			staticDir,
			{ recursive: true },
		);
	} catch {
		console.warn('[standalone] Warning: Could not copy backend static assets');
	}

	// Copy favicon if exists
	try {
		await fs.copyFile(
			path.resolve(rootDir, 'packages/backend/assets/favicon.ico'),
			path.resolve(outDir, 'favicon.ico'),
		);
	} catch { /* optional */ }

	try {
		await fs.cp(
			path.resolve(rootDir, 'node_modules/.pnpm/@discordapp+twemoji@15.1.0/node_modules/@discordapp/twemoji/dist/svg'),
			twemojiDir,
			{ recursive: true },
		);
	} catch {
		console.warn('[standalone] Warning: Could not copy twemoji SVG assets');
	}
}

async function generateIndexHtml() {
	console.log('[standalone] Generating index.html...');

	// Read the Vite manifest to find the entry point
	const manifestPath = path.resolve(outDir, 'manifest.json');
	const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

	// Find the entry file (from src/_boot_.ts)
	const entryKey = Object.keys(manifest).find(k => k.includes('_boot_'));
	if (!entryKey) {
		throw new Error('Could not find _boot_ entry in Vite manifest');
	}
	const entry = manifest[entryKey];

	// Build CSS link tags
	const cssLinks = (entry.css || [])
		.map(href => `\t<link rel="stylesheet" href="/${href}">`)
		.join('\n');

	// Build lang list for boot script
	const locales = buildLocales();
	const langs = JSON.stringify(Object.keys(locales));

	// Read the template
	const templatePath = path.resolve(rootDir, 'packages/frontend/static/index.html');
	let html = await fs.readFile(templatePath, 'utf-8');

	// Replace placeholders
	html = html.replace('__VERSION__', meta.version);
	html = html.replace('__CLIENT_ENTRY__', entry.file);
	html = html.replace('__LANGS__', langs);

	// Insert CSS links before </head>
	if (cssLinks) {
		html = html.replace(
			'</head>',
			`${cssLinks}\n\t<link rel="modulepreload" href="/${entry.file}">\n</head>`,
		);
	}

	await fs.writeFile(path.resolve(outDir, 'index.html'), html, 'utf-8');
}

async function generateHtaccess() {
	console.log('[standalone] Generating .htaccess...');

	const htaccess = `# Misskey Standalone Frontend
# SPA Fallback - all routes serve index.html
<IfModule mod_rewrite.c>
	RewriteEngine On
	RewriteBase /

	# Do not rewrite files or directories
	RewriteCond %{REQUEST_FILENAME} -f [OR]
	RewriteCond %{REQUEST_FILENAME} -d
	RewriteRule ^ - [L]

	# Rewrite everything else to index.html
	RewriteRule ^ index.html [L]
</IfModule>

# Cache static assets aggressively
<IfModule mod_expires.c>
	ExpiresActive On
	ExpiresByType text/css "access plus 30 days"
	ExpiresByType application/javascript "access plus 30 days"
	ExpiresByType application/json "access plus 1 day"
	ExpiresByType image/png "access plus 30 days"
	ExpiresByType image/svg+xml "access plus 30 days"
</IfModule>

# CORS headers for API requests (if proxied through Apache)
<IfModule mod_headers.c>
	Header set X-Content-Type-Options "nosniff"
	Header set X-Frame-Options "DENY"
	Header set Referrer-Policy "origin"
</IfModule>
`;
	await fs.writeFile(path.resolve(outDir, '.htaccess'), htaccess, 'utf-8');
}

async function main() {
	const startTime = Date.now();

	console.log(`[standalone] Building Misskey Standalone Frontend v${meta.version}`);
	console.log(`[standalone] Default instance: ${DEFAULT_INSTANCE_URL}`);
	console.log('');

	await clean();
	await buildSharedDependencies();
	await buildFrontend();
	await copyViteOutput();
	await copyLocales();
	await copyStaticAssets();
	await generateIndexHtml();
	await generateHtaccess();

	console.log('');
	console.log(`[standalone] Build complete! (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
	console.log(`[standalone] Output: ${outDir}`);
	console.log('[standalone] Upload the contents of this directory to your Apache server.');
}

main().catch(err => {
	console.error('[standalone] Build failed:', err);
	process.exit(1);
});
