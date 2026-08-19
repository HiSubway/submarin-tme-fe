<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div
	:class="[$style.root, {
		[$style.isNotResponding]: instance.isNotResponding,
		[$style.isSilenced]: instance.isSilenced,
		[$style.isSuspended]: instance.isSuspended,
		[$style.isBlocked]: instance.isBlocked,
	}]"
>
	<img :class="$style.icon" :src="getInstanceIcon(instance)" alt="" loading="lazy"/>
	<div :class="$style.body">
		<span :class="$style.host">{{ instance.name || instance.host }}</span>
		<span :class="$style.sub">
			<span class="_monospace">
				<span style="font-weight: 700;">{{ instance.host }}</span> / {{ instance.softwareName || '?' }} {{ instance.softwareVersion }}
			</span>
		</span>
	</div>
	<MkMiniChart v-if="chartValues" :class="$style.chart" :src="chartValues"/>
</div>
</template>

<script lang="ts" setup>
import { shallowRef, watch } from 'vue';
import * as Misskey from 'misskey-js';
import { misskeyApiGet } from '@/scripts/misskey-api.js';
import { getProxiedImageUrlNullable } from '@/scripts/media-proxy.js';
import MkMiniChart from '@/components/MkMiniChart.vue';

const props = defineProps<{
	instance: Misskey.entities.FederationInstance;
}>();

const chartValues = shallowRef<number[] | null>(null);

watch(() => props.instance.host, (host) => {
	misskeyApiGet('charts/instance', {
		host,
		limit: 16 + 1,
		span: 'day',
	}).then(res => {
		// 今日のぶんの値はまだ途中の値であり、それも含めると大抵の場合前日よりも下降しているようなグラフになってしまうため今日は弾く
		res.requests.received.shift();
		chartValues.value = res.requests.received;
	}).catch(() => {
		chartValues.value = null;
	});
}, {
	immediate: true,
});

const getInstanceIcon = (instance: Misskey.entities.FederationInstance) => (
	getProxiedImageUrlNullable(instance.iconUrl, 'preview')
		?? getProxiedImageUrlNullable(instance.faviconUrl, 'preview')
		?? '/client-assets/dummy.png'
);
</script>

<style lang="scss" module>
$bodyTitleHieght: 18px;
$bodyInfoHieght: 16px;

.root {
	display: flex;
	align-items: center;
	padding: 16px;
	border-radius: 8px;
	background-color: var(--MI_THEME-panel);

	&.isNotResponding,
	&.isSilenced,
	&.isSuspended,
	&.isBlocked {
		background-image: repeating-linear-gradient(
			135deg,
			transparent 0px 10px,
			var(--c) 6px 16px
		);
	}

	&,
	html[data-color-scheme=light] & {
		&.isNotResponding {
			--c: color-mix(in srgb, #ffa500 12.5%, var(--MI_THEME-panel));
		}

		&.isSilenced {
			--c: color-mix(in srgb, #0000ff 12.5%, var(--MI_THEME-panel));
		}

		&.isSuspended {
			--c: color-mix(in srgb, #000000 3.75%, var(--MI_THEME-panel));
		}

		&.isBlocked {
			--c: color-mix(in srgb, #ff0000 12.5%, var(--MI_THEME-panel));
		}
	}

	html[data-color-scheme=dark] & {
		&.isNotResponding {
			--c: color-mix(in srgb, #ffa500 25%, var(--MI_THEME-panel));
		}

		&.isSilenced {
			--c: color-mix(in srgb, #0000ff 25%, var(--MI_THEME-panel));
		}

		&.isSuspended {
			--c: color-mix(in srgb, #ffffff 7.5%, var(--MI_THEME-panel));
		}

		&.isBlocked {
			--c: color-mix(in srgb, #ff0000 25%, var(--MI_THEME-panel));
		}
	}
}

.icon {
	display: block;
	width: ($bodyTitleHieght + $bodyInfoHieght);
	height: ($bodyTitleHieght + $bodyInfoHieght);
	object-fit: cover;
	border-radius: 4px;
	margin-right: 12px;
}

.body {
	flex: 1;
	overflow: hidden;
	font-size: 0.9em;
	color: var(--MI_THEME-fg);
	padding-right: 8px;
}

.host {
	display: block;
	width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	line-height: $bodyTitleHieght;
}

.sub {
	display: block;
	width: 100%;
	font-size: 80%;
	opacity: 0.7;
	line-height: $bodyInfoHieght;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.chart {
	height: 30px;
}
</style>
