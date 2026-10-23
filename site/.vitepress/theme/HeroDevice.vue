<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';

const stage = ref<HTMLDivElement | null>(null);
const fx = ref<HTMLCanvasElement | null>(null);
const game = ref<HTMLCanvasElement | null>(null);
const knob = ref<HTMLDivElement | null>(null);
const btnA = ref<HTMLDivElement | null>(null);
const btnB = ref<HTMLDivElement | null>(null);
const phoneScreen = ref<HTMLDivElement | null>(null);
const phone = ref<HTMLDivElement | null>(null);
const tvScreen = ref<HTMLDivElement | null>(null);
const latency = ref(15);
const fps = ref(30);

let raf = 0;
let running = false;
let io: IntersectionObserver | undefined;
let ro: ResizeObserver | undefined;
let latTimer: ReturnType<typeof setInterval> | undefined;
let cleanup = () => {};
onBeforeUnmount(() => cleanup());

onMounted(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st = stage.value!, cv = fx.value!, gc = game.value!;
  const ctx = cv.getContext('2d')!, g = gc.getContext('2d')!;
  // Backing stores are capped: DPR at most 1.5 and at most 1200 px wide, so a 2x laptop screen stays cheap.
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  let dpr = DPR, gdpr = DPR;
  const grid = document.createElement('canvas');
  let stickR = 0, W = 0, H = 0, from = { x: 0, y: 0 }, to = { x: 0, y: 0 }, GW = 0, GH = 0, GRW = 0, GRH = 0, gx0 = 0, gy0 = 0;

  const measure = () => {
    const r = st.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(1, 1200 / Math.max(1, W)); // glow dots are soft, 1x is enough
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = phoneScreen.value!.getBoundingClientRect(), t = tvScreen.value!.getBoundingClientRect();
    from = { x: p.left - r.left + p.width * 0.5, y: p.top - r.top + p.height * 0.78 };
    to = { x: t.left - r.left + t.width * 0.22, y: t.top - r.top + t.height * 0.55 };
    const gr = gc.getBoundingClientRect();
    gx0 = gr.left - r.left; gy0 = gr.top - r.top;
    stickR = (knob.value?.parentElement?.clientWidth ?? 0) * 0.3;
    GW = gc.clientWidth; GH = gc.clientHeight; GRW = gr.width; GRH = gr.height;
    gdpr = Math.min(DPR, 1200 / Math.max(1, GW));
    gc.width = Math.round(GW * gdpr); gc.height = Math.round(GH * gdpr);
    g.setTransform(gdpr, 0, 0, gdpr, 0, 0);
    // the grid never changes: draw it once
    grid.width = gc.width; grid.height = gc.height;
    const gg = grid.getContext('2d')!;
    gg.setTransform(gdpr, 0, 0, gdpr, 0, 0);
    gg.strokeStyle = 'rgba(76,201,240,0.08)'; gg.lineWidth = 1;
    gg.beginPath();
    for (let x = 0; x < GW; x += 22) { gg.moveTo(x, 0); gg.lineTo(x, GH); }
    for (let y = 0; y < GH; y += 22) { gg.moveTo(0, y); gg.lineTo(GW, y); }
    gg.stroke();
  };

  // pre-rendered glow sprites (cheaper than shadowBlur every frame)
  const sprite = (color: string, size: number) => {
    const c = document.createElement('canvas');
    c.width = c.height = size * 2;
    const x = c.getContext('2d')!;
    const grd = x.createRadialGradient(size, size, 0, size, size, size);
    grd.addColorStop(0, '#fff'); grd.addColorStop(0.18, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = grd; x.fillRect(0, 0, size * 2, size * 2);
    return c;
  };
  const cyan = sprite('rgba(76,201,240,0.85)', 14);
  const rose = sprite('rgba(255,77,109,0.9)', 20);

  type Pkt = { t0: number; dur: number; s: HTMLCanvasElement; lift: number };
  const pkts: Pkt[] = [];
  let lastSpawn = 0;
  const trail: { x: number; y: number }[] = [];
  let px = 0.5, py = 0.5, bursts: { x: number; y: number; t0: number; c: string }[] = [];
  let aDown = false, bDown = false;
  const t0 = performance.now();

  const axes = (t: number) => {
    const s = t / 1000;
    return { x: Math.sin(s * 1.1) * 0.75 + Math.sin(s * 2.7) * 0.2, y: Math.sin(s * 0.8 + 1.3) * 0.7 };
  };

  let lastDraw = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = (now: number) => {
    if (!running) return;
    // 30 fps is plenty for this loop and halves its cost
    lastDraw = now;
    // the phone's float runs in this loop too, so the page only produces frames at 30 fps
    const fl = Math.sin((now - t0) / 1114);
    phone.value!.style.transform = `rotateY(${20 + fl * 2}deg) rotateX(${7 + fl}deg) rotateZ(${-1.5 - fl * 0.5}deg) translateY(${(-5 - fl * 5).toFixed(1)}px)`;
    const t = now - t0;
    const a = axes(t);
    const R = stickR;
    knob.value!.style.transform = `translate(${(a.x * R).toFixed(1)}px, ${(a.y * R).toFixed(1)}px)`;
    const na = t % 1700 < 170, nb = (t + 900) % 2600 < 170;
    if (na !== aDown) { aDown = na; btnA.value!.classList.toggle('down', na); if (na) spawn(now, rose, 0.7); }
    if (nb !== bDown) { bDown = nb; btnB.value!.classList.toggle('down', nb); if (nb) spawn(now, rose, -0.4); }
    if (now - lastSpawn > 1000 / 30) { lastSpawn = now; spawn(now, cyan, Math.sin(t / 300) * 0.15); }

    // packets
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    to = { x: gx0 + px * GRW, y: gy0 + py * GRH };
    const mx = (from.x + to.x) / 2, my = Math.min(from.y, to.y) - H * 0.18;
    for (let i = pkts.length - 1; i >= 0; i--) {
      const p = pkts[i]!;
      const k = (now - p.t0) / p.dur;
      if (k >= 1) { pkts.splice(i, 1); continue; }
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const cy = my + p.lift * H * 0.12;
      const x = (1 - e) ** 2 * from.x + 2 * (1 - e) * e * mx + e * e * to.x;
      const y = (1 - e) ** 2 * from.y + 2 * (1 - e) * e * cy + e * e * to.y;
      const fade = Math.min(1, k * 6, (1 - k) * 6);
      ctx.globalAlpha = fade;
      ctx.drawImage(p.s, x - p.s.width / 2, y - p.s.height / 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // the TV "game": input applied ~latency later
    const la = axes(t - latency.value);
    px += (0.5 + la.x * 0.4 - px) * 0.2;
    py += (0.54 + la.y * 0.36 - py) * 0.2;
    trail.push({ x: px * GW, y: py * GH });
    if (trail.length > 14) trail.shift();
    g.clearRect(0, 0, GW, GH);
    g.drawImage(grid, 0, 0, GW, GH);
    for (let i = 1; i < trail.length; i++) {
      g.strokeStyle = `rgba(76,201,240,${(i / trail.length) * 0.6})`;
      g.lineWidth = 2 + (i / trail.length) * 3;
      g.beginPath(); g.moveTo(trail[i - 1]!.x, trail[i - 1]!.y); g.lineTo(trail[i]!.x, trail[i]!.y); g.stroke();
    }
    if (na && !bursts.some((b) => now - b.t0 < 170 && b.c === 'r')) bursts.push({ x: px * GW, y: py * GH, t0: now, c: 'r' });
    if (nb && !bursts.some((b) => now - b.t0 < 170 && b.c === 'a')) bursts.push({ x: px * GW, y: py * GH, t0: now, c: 'a' });
    bursts = bursts.filter((b) => now - b.t0 < 600);
    for (const b of bursts) {
      const k = (now - b.t0) / 600;
      g.strokeStyle = b.c === 'r' ? `rgba(255,77,109,${1 - k})` : `rgba(255,209,102,${1 - k})`;
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(b.x, b.y, 6 + k * 34, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = '#4cc9f0';
    g.beginPath(); g.arc(px * GW, py * GH, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(px * GW, py * GH, 3, 0, Math.PI * 2); g.fill();

    // wait out the rest of a 30 fps slot without asking for frames, so idle frames cost nothing
    timer = setTimeout(() => { if (running) raf = requestAnimationFrame(frame); }, Math.max(0, 33 - (performance.now() - now)));
  };

  function spawn(now: number, s: HTMLCanvasElement, lift: number) {
    pkts.push({ t0: now, dur: 520 + latency.value * 6, s, lift });
  }

  const start = () => { if (running || reduced) return; running = true; raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); clearTimeout(timer); };

  measure();
  ro = new ResizeObserver(measure); ro.observe(st);
  let inView = false, focused = true;
  const sync = () => (inView && focused && !document.hidden ? start() : stop());
  io = new IntersectionObserver(([e]) => { inView = !!e?.isIntersecting; sync(); });
  io.observe(st);
  const onVis = () => sync();
  const onFocus = () => { focused = true; sync(); };
  const onBlur = () => { focused = false; sync(); };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);
  latTimer = setInterval(() => { if (running) latency.value = 13 + Math.round(Math.random() * 4); }, 700);

  const still = () => { running = true; frame(performance.now() + 2200); running = false; cancelAnimationFrame(raf); };
  if (reduced) { still(); ro.disconnect(); ro = new ResizeObserver(() => { measure(); still(); }); ro.observe(st); }
  cleanup = () => {
    stop(); io?.disconnect(); ro?.disconnect(); clearInterval(latTimer);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
  };
});
</script>

<template>
  <div ref="stage" class="hd-stage" role="img"
    aria-label="A phone showing a joystick and two buttons streams glowing input packets to a TV, which moves a dot in real time.">
    <div ref="phone" class="hd-phone">
      <div ref="phoneScreen" class="hd-phone-screen">
        <div class="hd-notch" />
        <div class="hd-phone-top">
          <span class="hd-dot-live" /> KMPV
        </div>
        <div class="hd-btns">
          <div ref="btnB" class="hd-btn b">B</div>
          <div ref="btnA" class="hd-btn a">A</div>
        </div>
        <div class="hd-stick"><div ref="knob" class="hd-knob" /></div>
      </div>
    </div>
    <div class="hd-tv">
      <div ref="tvScreen" class="hd-tv-screen">
        <canvas ref="game" class="hd-game" />
        <div class="hd-hud">
          <span class="hd-pill">direct</span>
          <span class="hd-lat"><b>{{ latency }}</b> ms</span>
          <span class="hd-hz">{{ fps }} Hz</span>
        </div>
      </div>
      <div class="hd-tv-stand" />
    </div>
    <canvas ref="fx" class="hd-fx" />
  </div>
</template>

<style scoped>
.hd-stage { position: relative; aspect-ratio: 16 / 11; perspective: 1400px; width: 100%; }
.hd-fx { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 3; }
.hd-phone {
  position: absolute; left: 2%; top: 9%; width: 29%; aspect-ratio: 9 / 18.5; z-index: 2;
  border-radius: 13% / 6.5%; padding: 3.2%; background: linear-gradient(145deg, #2a2f5c, #12152b);
  box-shadow: 0 40px 80px -20px rgba(0,0,0,.7), inset 0 0 0 1.5px rgba(255,255,255,.08), 0 0 0 1px #0a0c1a;
  transform: rotateY(20deg) rotateX(7deg) rotateZ(-1.5deg); will-change: transform;
}
.hd-phone-screen {
  position: relative; height: 100%; border-radius: 10% / 5%; overflow: hidden;
  background: radial-gradient(120% 70% at 50% 100%, rgba(76,201,240,.16), transparent 60%), #0a0c1a;
}
.hd-notch { position: absolute; top: 2.5%; left: 50%; width: 30%; height: 3%; transform: translateX(-50%); background: #000; border-radius: 99px; }
.hd-phone-top { position: absolute; top: 9%; left: 0; right: 0; text-align: center; font: 700 clamp(9px, 1.1vw, 13px) var(--cp-display); letter-spacing: .14em; color: var(--cp-amber); }
.hd-dot-live { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--cp-cyan); box-shadow: 0 0 8px var(--cp-cyan); margin-right: 4px; vertical-align: middle; }
.hd-btns { position: absolute; top: 24%; right: 9%; width: 62%; height: 30%; }
.hd-btn {
  position: absolute; width: 46%; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center;
  font: 800 clamp(10px, 1.2vw, 15px) var(--cp-display); color: #0a0c1a; transition: transform .09s, box-shadow .09s, filter .09s;
}
.hd-btn.a { right: 0; top: 34%; background: var(--cp-rose); box-shadow: 0 6px 0 #9c2238, 0 0 0 rgba(255,77,109,0); }
.hd-btn.b { left: 0; top: 0; background: var(--cp-amber); box-shadow: 0 6px 0 #a1802c; }
.hd-btn.down { transform: translateY(5px); box-shadow: 0 1px 0 #0000, 0 0 26px rgba(255,77,109,.7); filter: brightness(1.15); }
.hd-btn.b.down { box-shadow: 0 1px 0 #0000, 0 0 26px rgba(255,209,102,.7); }
.hd-stick {
  position: absolute; left: 50%; bottom: 10%; width: 62%; aspect-ratio: 1; transform: translateX(-50%);
  border-radius: 50%; border: 2px solid rgba(76,201,240,.45);
  background: radial-gradient(circle, rgba(76,201,240,.12), transparent 70%);
  display: grid; place-items: center;
}
.hd-knob { width: 40%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #a6e8fb, var(--cp-cyan) 55%, #1d8fb5); box-shadow: 0 0 22px rgba(76,201,240,.65); will-change: transform; }
.hd-tv {
  position: absolute; right: 0; top: 16%; width: 62%; z-index: 1;
  transform: rotateY(-14deg) rotateX(3deg); transform-origin: right center;
}
.hd-tv-screen {
  position: relative; aspect-ratio: 16 / 10; border-radius: 10px; padding: 2.2%;
  background: linear-gradient(160deg, #262b55, #12152b); box-shadow: 0 50px 90px -30px rgba(0,0,0,.8), 0 0 0 1px #0a0c1a, 0 0 70px -10px rgba(76,201,240,.22);
}
.hd-game { display: block; width: 100%; height: 100%; border-radius: 6px; background: radial-gradient(90% 90% at 50% 40%, #111735, #070914); }
.hd-hud { position: absolute; left: 5%; top: 7%; display: flex; gap: 8px; align-items: center; font: 500 clamp(9px, 1vw, 12px) var(--vp-font-family-mono); color: var(--cp-muted); }
.hd-pill { color: var(--cp-cyan); border: 1px solid rgba(76,201,240,.5); border-radius: 5px; padding: 1px 6px; }
.hd-lat b { color: var(--cp-text); font-weight: 600; display: inline-block; min-width: 2ch; text-align: right; font-variant-numeric: tabular-nums; }
.hd-tv-stand { width: 26%; height: 14px; margin: 0 auto; border-radius: 0 0 8px 8px; background: linear-gradient(#1b1f40, #0e1124); }
</style>
