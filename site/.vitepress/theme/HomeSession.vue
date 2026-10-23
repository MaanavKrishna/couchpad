<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import LinkDiagram from './LinkDiagram.vue';

type Id = 'home' | 'hotel' | 'refresh' | 'restart';
const steps: { id: Id; title: string; body: string; facts: string[] }[] = [
  { id: 'home', title: 'Home Wi-Fi: straight to the TV', body: 'The phone joins over WebSocket, then offers WebRTC through the server. Once both DataChannels open, input skips the server entirely.', facts: ['unordered input channel', 'reliable state channel', '2 s ping'] },
  { id: 'hotel', title: 'Hotel Wi-Fi: the relay takes over', body: 'Client isolation means ICE never finds a path. Input is relayed while the peer waits, and after 4 s it gives up on direct for good. A 60 KB drawing is split into three chunks and reassembled on the TV.', facts: ['OPEN_TIMEOUT_MS = 4000', 'RELAY_CHUNK_BYTES = 28 KB', 'partials expire after 10 s'] },
  { id: 'refresh', title: 'Phone refresh: same seat', body: 'The page reloads and its socket closes. On the way back, room.join carries the rejoin token, so the TV gets the same playerId and the player keeps their place.', facts: ['token in sessionStorage', 'player.left, then player.joined', 'fresh WebRTC offer'] },
  { id: 'restart', title: 'TV restart: same room', body: 'Phones see tv.left and queue reliable messages. The restarted TV resumes with its tvToken, the server answers with the live player list, and phones re-offer on tv.back.', facts: ['room.resume + tvToken', 'queue holds 64 messages', 'tv.back triggers re-offer'] },
];
const current = ref<Id>('home');
const root = ref<HTMLElement | null>(null);
let io: IntersectionObserver | undefined;

onMounted(() => {
  if (!window.matchMedia('(min-width: 961px)').matches) return;
  io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) current.value = (e.target as HTMLElement).dataset.id as Id;
  }, { rootMargin: '-45% 0px -45% 0px' });
  root.value?.querySelectorAll('.ss-step').forEach((el) => io!.observe(el));
});
onBeforeUnmount(() => io?.disconnect());

function go(id: Id) {
  current.value = id;
  const el = root.value?.querySelector<HTMLElement>(`.ss-step[data-id="${id}"]`);
  if (el && window.matchMedia('(min-width: 961px)').matches) {
    const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.4;
    window.scrollTo({ top: y, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}
</script>

<template>
  <div ref="root" class="ss">
    <ol class="ss-steps">
      <li v-for="(s, i) in steps" :key="s.id" class="ss-step" :class="{ on: current === s.id }" :data-id="s.id">
        <button type="button" class="ss-title" :aria-current="current === s.id ? 'step' : undefined" @click="go(s.id)">
          <span class="ss-num">{{ i + 1 }}</span>{{ s.title }}
        </button>
        <p>{{ s.body }}</p>
        <ul class="ss-facts"><li v-for="f in s.facts" :key="f">{{ f }}</li></ul>
      </li>
    </ol>
    <div class="ss-sticky">
      <LinkDiagram :scenario="current" @pick="(id) => go(id)" />
    </div>
  </div>
</template>

<style scoped>
.ss { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); gap: 48px; align-items: start; }
.ss-steps { list-style: none; margin: 0; padding: 0; }
.ss-step { min-height: 52vh; display: flex; flex-direction: column; justify-content: center; padding: 0 0 0 22px; margin: 0;
  border-left: 2px solid var(--cp-line); opacity: .38; transition: opacity .4s, border-color .4s; }
.ss-step.on { opacity: 1; border-color: var(--cp-cyan); }
.ss-step:first-child { min-height: 40vh; }
.ss-title { all: unset; cursor: pointer; display: flex; gap: 12px; align-items: baseline; font: 800 1.45rem/1.2 var(--cp-display); color: var(--cp-text); letter-spacing: -.01em; }
.ss-title:focus-visible { outline: 2px solid var(--cp-amber); outline-offset: 4px; border-radius: 4px; }
.ss-num { font: 600 .85rem var(--vp-font-family-mono); color: var(--cp-cyan); }
.ss-step p { color: var(--cp-muted); line-height: 1.65; margin: 12px 0 14px; max-width: 46ch; }
.ss-facts { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.ss-facts li { margin: 0; font: .78rem var(--vp-font-family-mono); color: var(--cp-text); border: 1px solid var(--cp-line); border-radius: 6px; padding: 3px 8px; background: rgba(21,24,49,.6); }
.ss-sticky { position: sticky; top: calc(var(--vp-nav-height, 64px) + 24px); }
@media (max-width: 960px) {
  .ss { grid-template-columns: 1fr; gap: 28px; }
  .ss-sticky { position: static; order: -1; }
  .ss-step, .ss-step:first-child { min-height: 0; opacity: 1; padding: 14px 0 14px 16px; }
}
</style>
