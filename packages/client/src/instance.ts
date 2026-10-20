import { computed, reactive } from 'vue';
import { InstanceMetadata as InstanceMetadata_ } from 'misskey-js/built/entities';
import { api } from './os';
import { parseObject } from '@/scripts/tms/parse';

type SomeNullable<T, D extends keyof T> = { [K in keyof T]: (K extends D ? T[K] | null | undefined : T[K]) };
type InstanceMetadata = SomeNullable<InstanceMetadata_, 'emojis'>;

// TODO: 他のタブと永続化されたstateを同期

const instanceData = localStorage.getItem('instance');

// TODO: instanceをリアクティブにするかは再考の余地あり

export const instance: InstanceMetadata = reactive(
	instanceData
		? parseObject<InstanceMetadata>(instanceData)
		: {
			// TODO: set default values
		} as InstanceMetadata,
);

export const fetchInstance = async (): Promise<void> => {
	const meta = await api('meta', {
		detail: false,
	});

	for (const [k, v] of Object.entries(meta)) {
		instance[k] = v;
	}

	// v12 は meta.emojis を配列として使う。2024 以降は /api/emojis に分離され、ノート側の emojis は名前から URL へのマップになる。
	if (!Array.isArray(instance.emojis)) {
		const emojiResponse = await api('emojis', {});
		const list = Array.isArray(emojiResponse) ? emojiResponse : emojiResponse?.emojis;
		if (Array.isArray(list)) {
			instance.emojis = list.map((emoji) => ({
				id: emoji.id ?? emoji.name,
				aliases: emoji.aliases ?? [],
				name: emoji.name,
				category: emoji.category ?? null,
				url: emoji.url,
				host: emoji.host ?? null,
			}));
		}
	}

	localStorage.setItem('instance', JSON.stringify(instance));
};

export const emojiCategories = computed(() => {
	if (!Array.isArray(instance.emojis)) return [];
	const categories = new Set();
	for (const emoji of instance.emojis) {
		categories.add(emoji.category);
	}
	return Array.from(categories);
});

export const emojiTags = computed(() => {
	if (!Array.isArray(instance.emojis)) return [];
	const tags = new Set();
	for (const emoji of instance.emojis) {
		for (const tag of emoji.aliases) {
			tags.add(tag);
		}
	}
	return Array.from(tags);
});

// このファイルに書きたくないけどここに書かないと何故かVeturが認識しない
declare module '@vue/runtime-core' {
	interface ComponentCustomProperties {
		$instance: typeof instance;
	}
}
