<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';

const pad = ref<HTMLDivElement | null>(null);
const knob = ref<HTMLDivElement | null>(null);
const tv = ref<HTMLCanvasElement | null>(null);
const wire = ref<HTMLCanvasElement | null>(null);
const frameText = ref('{ t: 0, axes: { x: 0, y: 0 }, buttons: { jump: false } }');
const sent = ref(0);
const keep = ref(0);
const dropped = ref(0);
const why = ref('idle');
const jump = ref(false);

// same rules as CouchClient.sendInput: 30 Hz throttle, immediate on a button edge, 100 ms keepalive while held
const INTERVAL = 1000 / 30, KEEPALIVE = 100;
let axes = { x: 0, y: 0 };
let lastSent = -Infinity, lastJump = false, pending = false;
let pkts: { t0: number; kind: 'move' | 'edge' | 'keep' }[] = [];
let tvPos = { x: 0.5, y: 0.5 }, target = { x: 0.5, y: 0.5 };
let rings: { x: number; y: number; t0: number }[] = [];
let raf = 0, cleanup = () => {};
onBeforeUnmount(() => cleanup());

const active = () => axes.x !== 0 || axes.y !== 0 || jump.value;

function emit(kind: 'move' | 'edge' | 'keep', now: number) {
  lastSent = now; pending = false;
  sent.value++;
  if (kind === 'keep') keep.value++;
  why.value = kind === 'edge' ? 'button edge, sent now' : kind === 'keep' ? 'held, 100 ms keepalive' : 'moved, throttled to 30 Hz';
  const f = { t: +(now).toFixed(1), axes: { x: +axes.x.toFixed(2), y: +axes.y.toFixed(2) }, buttons: { jump: jump.value } };
  frameText.value = `{ t: ${f.t}, axes: { x: ${f.axes.x}, y: ${f.axes.y} }, buttons: { jump: ${f.buttons.jump} } }`;
  pkts.push({ t0: now, kind });
  const snap = { ...axes }, j = jump.value;
  setTimeout(() => { target = { x: 0.5 + snap.x * 0.42, y: 0.5 + snap.y * 0.4 }; if (j && kind === 'edge') rings.push({ x: target.x, y: target.y, t0: performance.now() }); }, 16);
}

function change(now: number) {
  const edge = jump.value !== lastJump;
  lastJump = jump.value;
  if (edge) return emit('edge', now);
  if (now - lastSent >= INTERVAL) return emit('move', now);
  if (!pending) { pending = true; dropped.value++; }
}

function setAxes(x: number, y: number) {
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  if (Math.hypot(x, y) < 0.08) { x = 0; y = 0; }
  axes = { x, y };
  const R = (pad.value?.clientWidth ?? 160) * 0.32;
  if (knob.value) knob.value.style.transform = `translate(${x * R}px, ${y * R}px)`;
  change(performance.now());
}

function setJump(d: boolean) { if (jump.value === d) return; jump.value = d; change(performance.now()); }

onMounted(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const p = pad.value!, c = tv.value!, w = wire.value!;
  const g = c.getContext('2d')!, wg = w.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let CW = 0, CH = 0, WW = 0, WH = 0;
  const measure = () => {
    CW = c.clientWidth; CH = c.clientHeight; c.width = CW * dpr; c.height = CH * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    WW = w.clientWidth; WH = w.clientHeight; w.width = WW * dpr; w.height = WH * dpr; wg.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  measure();
  const ro = new ResizeObserver(measure); ro.observe(c); ro.observe(w);

  let dragging = -1;
  const fromEvent = (e: PointerEvent) => {
    const r = p.getBoundingClientRect(), R = r.width * 0.32;
    setAxes((e.clientX - (r.left + r.width / 2)) / R, (e.clientY - (r.top + r.height / 2)) / R);
  };
  const down = (e: PointerEvent) => { dragging = e.pointerId; p.setPointerCapture(e.pointerId); p.classList.add('on'); fromEvent(e); };
  const move = (e: PointerEvent) => { if (e.pointerId === dragging) fromEvent(e); };
  const up = (e: PointerEvent) => { if (e.pointerId !== dragging) return; dragging = -1; p.classList.remove('on'); setAxes(0, 0); };
  p.addEventListener('pointerdown', down); p.addEventListener('pointermove', move);
  p.addEventListener('pointerup', up); p.addEventListener('pointercancel', up);

  const keys = new Set<string>();
  const applyKeys = () => setAxes((keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0), (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0));
  const kd = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) { e.preventDefault(); keys.add(e.key); applyKeys(); } };
  const ku = (e: KeyboardEvent) => { if (keys.delete(e.key)) applyKeys(); };
  p.addEventListener('keydown', kd); p.addEventListener('keyup', ku);

  const keepTimer = setInterval(() => {
    const now = performance.now();
    if (pending && now - lastSent >= INTERVAL) return emit('move', now);
    if (active() && now - lastSent >= KEEPALIVE - 2) emit('keep', now);
  }, 10);

  // idle demo: until someone touches it, the stick draws a slow loop
  let touched = false;
  const markTouched = () => { touched = true; };
  p.addEventListener('pointerdown', markTouched, { once: true });
  p.addEventListener('keydown', markTouched, { once: true });
  let visible = false;
  const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; });
  io.observe(c);

  const t0 = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    if (!touched && !reduced) {
      const s = (now - t0) / 1000;
      const on = s % 6 < 4;
      setAxes(on ? Math.cos(s * 1.6) * 0.8 : 0, on ? Math.sin(s * 1.6) * 0.8 : 0);
      setJump(s % 3 > 2.6);
    }
    // tv
    tvPos.x += (target.x - tvPos.x) * 0.35; tvPos.y += (target.y - tvPos.y) * 0.35;
    g.clearRect(0, 0, CW, CH);
    g.strokeStyle = 'rgba(76,201,240,0.07)';
    for (let x = 0; x < CW; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, CH); g.stroke(); }
    for (let y = 0; y < CH; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y); g.stroke(); }
    rings = rings.filter((r) => now - r.t0 < 700);
    for (const r of rings) {
      const k = (now - r.t0) / 700;
      g.strokeStyle = `rgba(255,77,109,${1 - k})`; g.lineWidth = 3;
      g.beginPath(); g.arc(r.x * CW, r.y * CH, 10 + k * 50, 0, Math.PI * 2); g.stroke();
    }
    const dx = tvPos.x * CW, dy = tvPos.y * CH;
    const grd = g.createRadialGradient(dx, dy, 0, dx, dy, 34);
    grd.addColorStop(0, jump.value ? 'rgba(255,77,109,.55)' : 'rgba(76,201,240,.5)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(dx, dy, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = jump.value ? '#ff4d6d' : '#4cc9f0'; g.beginPath(); g.arc(dx, dy, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(dx, dy, 3.5, 0, Math.PI * 2); g.fill();
    // wire: each frame is a packet crossing the DataChannel
    wg.clearRect(0, 0, WW, WH);
    const vertical = WH > WW;
    wg.strokeStyle = 'rgba(76,201,240,0.25)'; wg.lineWidth = 2; wg.setLineDash([4, 6]);
    wg.beginPath();
    if (vertical) { wg.moveTo(WW / 2, 0); wg.lineTo(WW / 2, WH); } else { wg.moveTo(0, WH / 2); wg.lineTo(WW, WH / 2); }
    wg.stroke(); wg.setLineDash([]);
    pkts = pkts.filter((q) => now - q.t0 < 380);
    for (const q of pkts) {
      const k = (now - q.t0) / 380;
      const x = vertical ? WW / 2 : k * WW, y = vertical ? k * WH : WH / 2;
      wg.fillStyle = q.kind === 'edge' ? '#ff4d6d' : q.kind === 'keep' ? '#ffd166' : '#4cc9f0';
      wg.beginPath(); wg.arc(x, y, q.kind === 'move' ? 4 : 6, 0, Math.PI * 2); wg.fill();
    }
  };
  raf = requestAnimationFrame(frame);

  cleanup = () => {
    cancelAnimationFrame(raf); clearInterval(keepTimer); ro.disconnect(); io.disconnect();
  };
});
</script>

<template>
  <div class="pg">
    <div class="pg-phone">
      <div ref="pad" class="pg-pad" tabindex="0" role="application" aria-roledescription="joystick"
        aria-label="Demo joystick. Drag it, or focus it and use the arrow keys.">
        <div ref="knob" class="pg-knob" />
      </div>
      <button type="button" class="pg-jump" :class="{ down: jump }"
        @pointerdown.prevent="setJump(true)" @pointerup="setJump(false)" @pointerleave="setJump(false)" @pointercancel="setJump(false)"
        @keydown.space.prevent="setJump(true)" @keyup.space="setJump(false)" @keydown.enter.prevent="setJump(true)" @keyup.enter="setJump(false)">JUMP</button>
      <p class="pg-hint">Drag the stick, hold JUMP</p>
    </div>
    <div class="pg-mid">
      <canvas ref="wire" class="pg-wire" aria-hidden="true" />
      <div class="pg-inspect">
        <div class="pg-row"><span>last frame</span><em>{{ why }}</em></div>
        <code class="pg-frame">{{ frameText }}</code>
        <dl class="pg-stats">
          <div><dt>frames sent</dt><dd>{{ sent }}</dd></div>
          <div><dt>keepalives</dt><dd>{{ keep }}</dd></div>
          <div><dt>coalesced</dt><dd>{{ dropped }}</dd></div>
        </dl>
        <ul class="pg-key">
          <li><i class="c" />move, 30 Hz</li><li><i class="r" />button edge</li><li><i class="a" />keepalive</li>
        </ul>
      </div>
    </div>
    <div class="pg-tv">
      <canvas ref="tv" class="pg-screen" role="img" aria-label="Mock TV screen. A dot follows the joystick." />
      <div class="pg-stand" />
    </div>
  </div>
</template>

<style scoped>
.pg { display: grid; grid-template-columns: 220px minmax(0, 1fr) minmax(0, 1.3fr); gap: 24px; align-items: center; }
.pg-phone { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 26px 18px; border-radius: 30px;
  background: linear-gradient(160deg, #20244a, #12152b); border: 1px solid var(--cp-line); box-shadow: 0 30px 60px -30px rgba(0,0,0,.8); }
.pg-pad { width: 160px; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; touch-action: none; cursor: grab;
  border: 2px solid rgba(76,201,240,.45); background: radial-gradient(circle, rgba(76,201,240,.14), transparent 70%); }
.pg-pad.on { cursor: grabbing; border-color: var(--cp-cyan); box-shadow: 0 0 30px rgba(76,201,240,.3); }
.pg-knob { width: 64px; aspect-ratio: 1; border-radius: 50%; pointer-events: none; will-change: transform;
  background: radial-gradient(circle at 35% 30%, #a6e8fb, var(--cp-cyan) 55%, #1d8fb5); box-shadow: 0 0 24px rgba(76,201,240,.6); }
.pg-jump { width: 120px; height: 54px; border-radius: 16px; border: 0; cursor: pointer; font: 800 1rem var(--cp-display); letter-spacing: .06em;
  color: #0a0c1a; background: var(--cp-rose); box-shadow: 0 6px 0 #9c2238; transition: transform .08s, box-shadow .08s; touch-action: none; }
.pg-jump.down { transform: translateY(5px); box-shadow: 0 1px 0 #9c2238, 0 0 30px rgba(255,77,109,.6); }
.pg-hint { margin: 0; color: var(--cp-dim); font-size: .85rem; }
.pg-mid { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.pg-wire { width: 100%; height: 26px; display: block; }
.pg-inspect { background: #0a0c1a; border: 1px solid var(--cp-line); border-radius: 14px; padding: 14px 16px; }
.pg-row { display: flex; justify-content: space-between; gap: 10px; color: var(--cp-dim); font-size: .8rem; }
.pg-row em { font-style: normal; color: var(--cp-amber); }
.pg-frame { display: block; margin: 8px 0 12px; font: .8rem/1.5 var(--vp-font-family-mono); color: var(--cp-cyan); background: none; padding: 0; min-height: 3em; overflow-wrap: anywhere; }
.pg-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0; }
.pg-stats div { border-top: 1px solid var(--cp-line); padding-top: 8px; }
.pg-stats dt { color: var(--cp-dim); font-size: .75rem; }
.pg-stats dd { margin: 0; color: var(--cp-text); font: 700 1.3rem var(--cp-display); font-variant-numeric: tabular-nums; }
.pg-key { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 0; margin: 12px 0 0; color: var(--cp-muted); font-size: .78rem; }
.pg-key li { margin: 0; display: flex; align-items: center; gap: 6px; }
.pg-key i { width: 8px; height: 8px; border-radius: 50%; }
.pg-key .c { background: var(--cp-cyan); } .pg-key .r { background: var(--cp-rose); } .pg-key .a { background: var(--cp-amber); }
.pg-tv { min-width: 0; }
.pg-screen { display: block; width: 100%; aspect-ratio: 16 / 10; border-radius: 12px; border: 8px solid #1d2145;
  background: radial-gradient(90% 90% at 50% 40%, #111735, #070914); box-shadow: 0 40px 80px -30px rgba(0,0,0,.8), 0 0 60px -10px rgba(76,201,240,.2); }
.pg-stand { width: 26%; height: 12px; margin: 0 auto; border-radius: 0 0 8px 8px; background: #1b1f40; }
@media (max-width: 960px) {
  .pg { grid-template-columns: 1fr; }
  .pg-phone { flex-direction: row; flex-wrap: wrap; justify-content: center; }
  .pg-hint { width: 100%; text-align: center; }
}
</style>
<style scoped>
@media (max-width: 960px) { .pg-tv { order: 2; } .pg-mid { order: 3; } }
</style>
