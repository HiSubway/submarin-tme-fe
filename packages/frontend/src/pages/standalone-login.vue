<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="standalone-login">
	<div class="container">
		<div class="logo">
			<img :src="instance.iconUrl || '/client-assets/about-icon.png'" alt="Misskey" class="icon"/>
		</div>

		<div v-if="errorMessage" class="error">
			<p>{{ errorMessage }}</p>
		</div>

		<form class="form" @submit.prevent="doLogin">
			<div class="field">
				<label for="host">{{ i18n.ts.server }}</label>
				<input
					id="host"
					v-model="host"
					type="text"
					:placeholder="'submarin.online'"
					autocomplete="url"
					required
				/>
				<p class="hint">{{ i18n.ts.serverAddress || 'APIサーバーのホスト名' }}</p>
			</div>

			<div class="field">
				<label for="token">{{ i18n.ts.token || 'API Token' }}</label>
				<input
					id="token"
					v-model="token"
					type="password"
					placeholder="API Token"
					autocomplete="off"
					required
				/>
			</div>

			<div class="actions">
				<button class="primary" type="submit" :disabled="processing">
					<template v-if="processing">
						<i class="ti ti-loader-2 spin"></i>
					</template>
					<template v-else>
						{{ i18n.ts.login }}
					</template>
				</button>
			</div>
		</form>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { miLocalStorage } from '@/local-storage.js';
import { normalizeMisskeyUrls } from '@/scripts/resolve-misskey-url.js';
import { unisonReload } from '@/scripts/unison-reload.js';

const host = ref(miLocalStorage.getItem('standaloneHost') || 'submarin.online');
const token = ref('');
const processing = ref(false);
const errorMessage = ref('');

async function doLogin() {
	processing.value = true;
	errorMessage.value = '';

	const targetHost = host.value.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
	const apiBase = `https://${targetHost}`;

	try {
		// Update the instance_url meta tag so config.ts picks up the new origin
		const metaEl = document.querySelector<HTMLMetaElement>('meta[property="instance_url"]');
		if (metaEl) {
			metaEl.content = apiBase;
		}

		// Verify the token by calling /api/i
		const res = await window.fetch(`${apiBase}/api/i`, {
			method: 'POST',
			body: JSON.stringify({ i: token.value.trim() }),
			credentials: 'omit',
			headers: { 'Content-Type': 'application/json' },
		});

		if (!res.ok) {
			const err = await res.json().catch(() => null);
			if (err?.error) {
				errorMessage.value = `認証エラー: ${err.error.message || err.error.code || 'Unknown error'}`;
			} else {
				errorMessage.value = `サーバーエラー: HTTP ${res.status}`;
			}
			processing.value = false;
			return;
		}

		const me = normalizeMisskeyUrls(await res.json());
		me.token = token.value.trim();

		// Save connection info
		miLocalStorage.setItem('standaloneHost', targetHost);
		miLocalStorage.setItem('account', JSON.stringify(me));

		// Clear locale cache so it re-fetches from the new server
		miLocalStorage.removeItem('locale');
		miLocalStorage.removeItem('localeVersion');
		miLocalStorage.removeItem('instance');
		miLocalStorage.removeItem('instanceCachedAt');

		// Also save to accounts list (IndexedDB)
		try {
			const { set, get, del } = await import('@/scripts/idb-proxy.js');
			const accounts = (await get('accounts')) || [];
			if (!accounts.some((x: any) => x.id === me.id)) {
				accounts.push({ id: me.id, token: me.token });
				await set('accounts', accounts);
			}

			await Promise.all([
				del('emojis'),
				del('lastEmojisFetchedAt'),
				del(`emojis:${targetHost}`),
				del(`lastEmojisFetchedAt:${targetHost}`),
			]);
		} catch { /* idb may not be available */ }

		unisonReload('/');
	} catch (e: any) {
		errorMessage.value = `接続エラー: ${e.message || 'サーバーに接続できません'}`;
		processing.value = false;
	}
}
</script>

<style lang="scss" scoped>
@keyframes spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}

.spin {
	animation: spin 1s linear infinite;
}

.standalone-login {
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 100vh;
	padding: 16px;

	> .container {
		width: 100%;
		max-width: 440px;

		> .logo {
			text-align: center;
			margin-bottom: 32px;

			> .icon {
				width: 72px;
				height: 72px;
				border-radius: 12px;
			}
		}

		> .error {
			background: rgba(255, 0, 0, 0.1);
			border: 1px solid rgba(255, 0, 0, 0.3);
			border-radius: 8px;
			padding: 12px 16px;
			margin-bottom: 16px;
			color: #f00;
			font-size: 0.9em;
		}

		> .form {
			background: var(--MI_THEME-panel);
			border-radius: 12px;
			padding: 24px;

			> .field {
				margin-bottom: 20px;

				> label {
					display: block;
					font-weight: bold;
					margin-bottom: 6px;
					font-size: 0.9em;
					color: var(--MI_THEME-fg);
				}

				> input {
					display: block;
					width: 100%;
					padding: 10px 12px;
					box-sizing: border-box;
					border: 1px solid var(--MI_THEME-divider);
					border-radius: 8px;
					font-size: 1em;
					background: var(--MI_THEME-bg);
					color: var(--MI_THEME-fg);

					&:focus {
						outline: none;
						border-color: var(--MI_THEME-accent);
					}
				}

				> .hint {
					font-size: 0.8em;
					color: var(--MI_THEME-fg);
					opacity: 0.6;
					margin: 6px 0 0;
				}
			}

			> .actions {
				> .primary {
					display: block;
					width: 100%;
					padding: 12px;
					border: none;
					border-radius: 999px;
					font-size: 1em;
					font-weight: bold;
					cursor: pointer;
					background: var(--MI_THEME-accent);
					color: var(--MI_THEME-fgOnAccent);

					&:hover {
						opacity: 0.9;
					}

					&:disabled {
						opacity: 0.5;
						cursor: not-allowed;
					}
				}
			}
		}
	}
}
</style>
