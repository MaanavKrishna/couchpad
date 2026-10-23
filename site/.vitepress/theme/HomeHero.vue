<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { withBase } from 'vitepress';
import HeroDevice from './HeroDevice.vue';

const words = ['Turn', 'any', 'phone', 'into', 'a', 'game', 'controller.', 'No', 'app.'];
const bar = ref<HTMLDivElement | null>(null);
let onScroll: (() => void) | undefined;
let rio: IntersectionObserver | undefined;
onMounted(() => {
  let queued = false;
  onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const h = document.documentElement;
      const k = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      if (bar.value) bar.value.style.transform = `scaleX(${k.toFixed(4)})`;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('cp-reveal-ready');
    rio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); rio!.unobserve(e.target); } }), { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.cp-reveal').forEach((el) => rio!.observe(el));
  }
  onScroll();
});
onBeforeUnmount(() => {
  if (onScroll) window.removeEventListener('scroll', onScroll);
  rio?.disconnect();
  document.documentElement.classList.remove('cp-reveal-ready');
});
</script>

<template>
  <div ref="bar" class="cp-progress" aria-hidden="true" />
  <section class="cp-hero">
    <div class="cp-mesh" aria-hidden="true"><i /><i /><i /></div>
    <div class="cp-wrap cp-hero-grid">
      <div class="cp-hero-copy">
        <p class="cp-kicker cp-in" style="--d: 0ms">A small TypeScript library for TV and web games</p>
        <h1 class="cp-title" aria-label="Turn any phone into a game controller. No app.">
          <template v-for="(w, i) in words" :key="i"><br v-if="i === 7" class="cp-br" /><span class="cp-word" aria-hidden="true"
            :style="{ '--d': `${80 + i * 70}ms` }">{{ w }}</span></template>
        </h1>
        <p class="cp-lede cp-in" style="--d: 760ms">
          Players scan a QR code on the TV and their phone becomes a gamepad. Input streams over a
          WebRTC DataChannel, and when the network blocks that, a WebSocket relay carries it instead.
          Your game never has to know which one it got.
        </p>
        <div class="cp-actions cp-in" style="--d: 880ms">
          <a class="cp-cta" :href="withBase('/docs/getting-started')">Get started</a>
          <a class="cp-cta ghost" :href="withBase('/docs/api')">API reference</a>
          <a class="cp-cta ghost" href="https://github.com/MaanavKrishna/couchpad">GitHub</a>
        </div>
        <pre class="cp-install cp-in" style="--d: 980ms" aria-label="Install command"><span aria-hidden="true">$ </span>npm install github:MaanavKrishna/couchpad</pre>
      </div>
      <div class="cp-hero-art cp-in" style="--d: 300ms"><HeroDevice /></div>
    </div>
  </section>
</template>
