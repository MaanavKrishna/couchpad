<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
// Mounts heavy children only when they come near the viewport.
const props = defineProps<{ minHeight?: string }>();
const show = ref(false);
const el = ref<HTMLElement | null>(null);
let io: IntersectionObserver | undefined;
onMounted(() => {
  if (!('IntersectionObserver' in window)) { show.value = true; return; }
  io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { show.value = true; io?.disconnect(); } }, { rootMargin: '600px 0px' });
  if (el.value) io.observe(el.value);
});
onBeforeUnmount(() => io?.disconnect());
</script>

<template>
  <div ref="el" :style="show ? undefined : { minHeight: props.minHeight ?? '480px' }"><slot v-if="show" /></div>
</template>
