<template>
<div class="standalone-login">
	<form class="container" @submit.prevent="doLogin">
		<h1>Submarin v12</h1>

		<p v-if="errorMessage" class="error">{{ errorMessage }}</p>

		<label>
			<span>サーバー</span>
			<input v-model="host" type="text" autocomplete="url" required placeholder="submarin.online"/>
		</label>

		<label>
			<span>API トークン</span>
			<input v-model="token" type="password" autocomplete="off" required/>
		</label>

		<button type="submit" :disabled="processing">{{ processing ? '接続中…' : 'ログイン' }}</button>
	</form>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { addAccount } from '@/account';
import { unisonReload } from '@/scripts/unison-reload';
import { normalizeMisskeyUrls } from '@/scripts/resolve-misskey-url';

const host = ref(localStorage.getItem('standaloneHost') || 'submarin.online');
const token = ref('');
const processing = ref(false);
const errorMessage = ref('');

async function doLogin(): Promise<void> {
	processing.value = true;
	errorMessage.value = '';

	const targetHost = host.value.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
	const apiBase = `https://${targetHost}`;

	try {
		const res = await fetch(`${apiBase}/api/i`, {
			method: 'POST',
			body: JSON.stringify({ i: token.value.trim() }),
			credentials: 'omit',
			cache: 'no-cache',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		const body = await res.json().catch(() => null);

		if (!res.ok || body == null || body.error) {
			const message = body?.error?.message || body?.error?.code;
			errorMessage.value = message ? `認証エラー: ${message}` : `サーバーエラー: HTTP ${res.status}`;
			processing.value = false;
			return;
		}

		const me = normalizeMisskeyUrls(body);
		me.token = token.value.trim();

		localStorage.setItem('standaloneHost', targetHost);
		localStorage.setItem('account', JSON.stringify(me));
		localStorage.removeItem('instance');
		localStorage.removeItem('v');

		const metaEl = document.querySelector<HTMLMetaElement>('meta[property="instance_url"]');
		if (metaEl) metaEl.content = apiBase;

		await addAccount(me.id, me.token);
		unisonReload('/');
	} catch (err) {
		errorMessage.value = `接続エラー: ${err instanceof Error ? err.message : 'サーバーに接続できません'}`;
		processing.value = false;
	}
}
</script>

<style scoped>
.standalone-login {
	display: flex;
	min-height: 100vh;
	align-items: center;
	justify-content: center;
	padding: 16px;
	background: #1a1a1a;
	color: #f0f0f0;
}

.container {
	display: flex;
	flex-direction: column;
	gap: 12px;
	width: min(420px, 100%);
	padding: 24px;
	border-radius: 12px;
	background: #2a2a2a;
}

h1 {
	margin: 0;
	font-size: 1.4rem;
}

label {
	display: flex;
	flex-direction: column;
	gap: 4px;
	font-size: 0.9rem;
}

input {
	padding: 8px 10px;
	border: 1px solid #555;
	border-radius: 8px;
	background: #111;
	color: inherit;
}

button {
	margin-top: 8px;
	padding: 10px 16px;
	border: 0;
	border-radius: 999px;
	background: #86b300;
	color: #111;
	font-weight: 700;
	cursor: pointer;
}

button:disabled {
	opacity: 0.6;
	cursor: wait;
}

.error {
	margin: 0;
	color: #ff8a8a;
}
</style>
