<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
// Every number below is a constant in src/ (file and name noted for each row).
const rows = [
  { icon: 'timer', pre: '', v: 4, suf: ' s', what: 'to open WebRTC, then relay', how: 'If both DataChannels are not open within OPEN_TIMEOUT_MS, the peer fails over to the WebSocket relay for good. Input is relayed while it waits, so nothing blocks.', src: 'peer.ts: OPEN_TIMEOUT_MS' },
  { icon: 'chunk', pre: '', v: 28, suf: ' KB', what: 'relay chunk size', how: 'Relay payloads above RELAY_CHUNK_BYTES are split into ~chunk envelopes that fit 32 KB API Gateway frames, and reassembled per sender. Partials expire after 10 s.', src: 'util.ts: RELAY_CHUNK_BYTES' },
  { icon: 'hz', pre: '', v: 30, suf: ' Hz', what: 'continuous input', how: 'Stick, tilt and held buttons go on an unordered, no-retransmit channel. Button presses skip the throttle so an edge is never late.', src: 'client.ts: INPUT_HZ' },
  { icon: 'beat', pre: '', v: 100, suf: ' ms', what: 'held-input keepalive', how: 'While anything is held the latest frame is resent. A release is sent twice, 30 ms apart, and blur or a hidden tab sends a zeroed frame.', src: 'client.ts: KEEPALIVE_MS' },
  { icon: 'ping', pre: '', v: 2, suf: ' s', what: 'ping and ICE grace', how: 'A ping every 2 s measures round-trip time. A disconnected ICE state gets 2 s to recover before the link drops to relay.', src: 'client.ts: PING_INTERVAL_MS' },
  { icon: 'backoff', pre: '250 ms–', v: 8, suf: ' s', what: 'reconnect backoff', how: 'Socket drops retry with ±30% jitter. Backoff only resets after a socket stays open for 3 s, so flapping links keep backing off.', src: 'signaling.ts: BACKOFF_MS' },
  { icon: 'queue', pre: '', v: 64, suf: '', what: 'queued reliable messages', how: 'While no path is up, reliable sends wait in a bounded queue and flush in order when the link returns.', src: 'client.ts: RELIABLE_QUEUE_MAX' },
  { icon: 'draw', pre: '', v: 200, suf: ' KB', what: 'largest drawing', how: 'The draw pad exports a JPEG of at most 256 px, lowering quality until it fits 25 KB. Anything over 200 KB is dropped before send.', src: 'util.ts: MAX_DRAW_BYTES' },
];
const shown = ref(rows.map((r) => r.v));
const root = ref<HTMLElement | null>(null);
let io: IntersectionObserver | undefined;
let onScroll: (() => void) | undefined;

function spot(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement, r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  shown.value = rows.map(() => 0);
  const fire = (el: HTMLElement) => {
    if (el.classList.contains('is-in')) return;
    const i = Number(el.dataset.i);
    el.classList.add('is-in');
    io!.unobserve(el);
    const t0 = performance.now(), dur = 1100 + (i % 2) * 150;
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / dur)), ease = 1 - Math.pow(1 - k, 4);
      shown.value[i] = Math.round(rows[i]!.v * ease);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) fire(e.target as HTMLElement); }, { threshold: 0.4 });
  const cards = [...(root.value?.querySelectorAll<HTMLElement>('.cp-spec') ?? [])];
  cards.forEach((el) => io!.observe(el));
  onScroll = () => { for (const el of cards) if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < innerHeight) fire(el); };
  window.addEventListener('scroll', onScroll, { passive: true });
});
onBeforeUnmount(() => { io?.disconnect(); if (onScroll) window.removeEventListener('scroll', onScroll); });
</script>

<template>
  <section ref="root" class="cp-specs" aria-labelledby="cp-specs-h">
    <div class="cp-wrap">
      <h2 id="cp-specs-h" class="cp-h2 cp-reveal">Built for phones on a couch</h2>
      <p class="cp-sub-lede cp-reveal">Phones lock, refresh and wander between rooms. These are the numbers couchpad uses to keep a seat alive, straight from the source.</p>
      <dl class="cp-spec-list">
        <div v-for="(r, i) in rows" :key="r.src" class="cp-spec" :data-i="i" @pointermove="spot">
          <dt>
            <svg class="cp-ico" :class="`ico-${r.icon}`" viewBox="0 0 40 40" aria-hidden="true">
              <template v-if="r.icon === 'timer'"><circle cx="20" cy="21" r="13" class="trk" /><circle cx="20" cy="21" r="13" class="sweep" /><path d="M17 5h6" class="ln" /></template>
              <template v-else-if="r.icon === 'chunk'"><rect x="5" y="14" width="9" height="12" rx="2" class="p1" /><rect x="15.5" y="14" width="9" height="12" rx="2" class="p2" /><rect x="26" y="14" width="9" height="12" rx="2" class="p3" /></template>
              <template v-else-if="r.icon === 'hz'"><rect v-for="k in 5" :key="k" :x="4 + (k - 1) * 7" y="8" width="4" height="24" rx="2" class="bar" :style="{ animationDelay: `${k * -0.13}s` }" /></template>
              <template v-else-if="r.icon === 'beat'"><path d="M3 21h9l3-8 5 16 4-12 3 4h10" class="pulse" /></template>
              <template v-else-if="r.icon === 'ping'"><circle cx="20" cy="20" r="4" class="dot" /><circle cx="20" cy="20" r="6" class="ring" /><circle cx="20" cy="20" r="6" class="ring r2" /></template>
              <template v-else-if="r.icon === 'backoff'"><circle v-for="(x, k) in [5, 9, 14, 21, 32]" :key="k" :cx="x" cy="20" r="2.6" class="bo" :style="{ animationDelay: `${k * 0.25}s` }" /></template>
              <template v-else-if="r.icon === 'queue'"><rect v-for="k in 4" :key="k" x="8" :y="6 + (k - 1) * 7.5" width="24" height="5" rx="2" class="q" :style="{ animationDelay: `${k * 0.2}s` }" /></template>
              <template v-else><path d="M5 28c5-14 9-14 11-6s6 8 9-2 6-10 10-4" class="ink" /></template>
            </svg>
            <span class="cp-spec-n">{{ r.pre }}{{ shown[i] }}{{ r.suf }}</span>
            <span class="cp-spec-what">{{ r.what }}</span>
          </dt>
          <dd>{{ r.how }}<code class="cp-spec-src">{{ r.src }}</code></dd>
        </div>
      </dl>
      <ul class="cp-facts">
        <li><strong>1</strong> runtime dependency (zod)</li>
        <li><strong>8</strong> widget kinds</li>
        <li><strong>39</strong> tests, no browser needed</li>
        <li><strong>13–16 ms</strong> phone to Fire TV in Cadabra</li>
      </ul>
    </div>
  </section>
</template>
