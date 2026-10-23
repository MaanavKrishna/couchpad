<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';

type Kind = 'input' | 'state' | 'signal' | 'relay' | 'ping' | 'chunk';
type Seg = { id: 'direct' | 'up' | 'down'; rev?: boolean };

const scenarios = [
  { id: 'home', label: 'Home Wi-Fi', note: 'WebRTC opens, input goes peer to peer.' },
  { id: 'hotel', label: 'Hotel Wi-Fi', note: 'Client isolation blocks WebRTC. The relay takes over after 4 s.' },
  { id: 'refresh', label: 'Phone refresh', note: 'The rejoin token gives the phone its seat back.' },
  { id: 'restart', label: 'TV restart', note: 'The TV token resumes the room; phones re-offer.' },
] as const;
type ScenarioId = (typeof scenarios)[number]['id'];
const props = defineProps<{ scenario?: ScenarioId }>();
const emit = defineEmits<{ (e: 'pick', id: ScenarioId): void }>();

const active = ref<ScenarioId>('home');
const mode = ref<'connecting' | 'direct' | 'relay'>('connecting');
const phoneUp = ref(true);
const tvUp = ref(true);
const blocked = ref(false);
const countdown = ref('');
const log = ref<{ id: number; dir: string; text: string; kind: Kind | 'note' }[]>([]);

const svg = ref<SVGSVGElement | null>(null);

const WIDE = {
  vb: '0 0 960 340', phone: 'translate(62 96)', tv: 'translate(742 124)', server: 'translate(420 14)',
  up: 'M120 96 C 120 40, 300 40, 420 40', down: 'M540 40 C 690 40, 830 44, 830 124',
  direct: 'M178 206 L 742 206', cap: [460, 232, 'middle'], x: [460, 206], count: [460, 192, 'middle'],
};
const TALL = {
  vb: '0 0 360 572', phone: 'translate(30 16)', tv: 'translate(20 400)', server: 'translate(220 196)',
  up: 'M146 86 C 280 86, 280 120, 280 196', down: 'M280 248 C 280 400, 250 456, 196 456',
  direct: 'M88 228 L 108 400', cap: [112, 330, 'start'], x: [98, 314], count: [112, 300, 'start'],
};
const geo = ref<typeof WIDE>(WIDE);
let mq: MediaQueryList | undefined;
const pickGeo = () => { geo.value = mq?.matches ? TALL : WIDE; };
const layer = ref<SVGGElement | null>(null);

let timers: ReturnType<typeof setTimeout>[] = [];
let streams: ReturnType<typeof setInterval>[] = [];
let raf = 0;
let reduced = false;
let vis: IntersectionObserver | undefined;
let logSeq = 0;
const packets: { el: SVGElement; route: Seg[]; t0: number; dur: number }[] = [];

const COLORS: Record<Kind, string> = {
  input: 'var(--cp-cyan)', state: 'var(--cp-rose)', signal: 'var(--cp-dim)',
  relay: 'var(--cp-amber)', ping: 'var(--cp-text)', chunk: 'var(--cp-amber)',
};

function say(dir: string, text: string, kind: Kind | 'note' = 'note') {
  log.value = [...log.value.slice(-6), { id: ++logSeq, dir, text, kind }];
}

function pathEl(id: Seg['id']) {
  return svg.value?.querySelector<SVGPathElement>(`#cp-path-${id}`) ?? null;
}

function send(route: Seg[], kind: Kind, dur = 900, label?: string) {
  const g = layer.value;
  if (!g) return;
  const ns = 'http://www.w3.org/2000/svg';
  const grp = document.createElementNS(ns, 'g');
  if (kind === 'input') {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('r', '4.5');
    c.setAttribute('fill', COLORS[kind]);
    grp.appendChild(c);
  } else {
    const r = document.createElementNS(ns, 'rect');
    const w = kind === 'chunk' ? 30 : 12;
    r.setAttribute('x', String(-w / 2)); r.setAttribute('y', '-6');
    r.setAttribute('width', String(w)); r.setAttribute('height', '12'); r.setAttribute('rx', '2.5');
    r.setAttribute('fill', kind === 'signal' || kind === 'ping' ? 'none' : COLORS[kind]);
    r.setAttribute('stroke', COLORS[kind]); r.setAttribute('stroke-width', '2');
    grp.appendChild(r);
    if (label) {
      const t = document.createElementNS(ns, 'text');
      t.textContent = label;
      t.setAttribute('y', '-11'); t.setAttribute('text-anchor', 'middle');
      t.setAttribute('class', 'cp-pkt-label');
      grp.appendChild(t);
    }
  }
  g.appendChild(grp);
  packets.push({ el: grp, route, t0: performance.now(), dur: reduced ? 1 : dur });
}

function place(p: (typeof packets)[number], now: number) {
  const k = Math.min(1, (now - p.t0) / p.dur);
  const paths = p.route.map((s) => pathEl(s.id));
  if (paths.some((x) => !x)) return true;
  const lens = paths.map((x) => x!.getTotalLength());
  const total = lens.reduce((a, b) => a + b, 0);
  let d = k * total;
  for (let i = 0; i < paths.length; i++) {
    if (d <= lens[i]! || i === paths.length - 1) {
      const at = p.route[i]!.rev ? lens[i]! - Math.min(d, lens[i]!) : Math.min(d, lens[i]!);
      const pt = paths[i]!.getPointAtLength(at);
      p.el.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      break;
    }
    d -= lens[i]!;
  }
  return k >= 1;
}

let onScreen = true;
function tick(now: number) {
  if (!onScreen) { raf = 0; return; }
  for (let i = packets.length - 1; i >= 0; i--) {
    const p = packets[i]!;
    if (place(p, now)) { p.el.remove(); packets.splice(i, 1); }
  }
  raf = requestAnimationFrame(tick);
}

const UP: Seg[] = [{ id: 'up' }, { id: 'down' }];          // phone -> server -> TV
const DOWN: Seg[] = [{ id: 'down', rev: true }, { id: 'up', rev: true }]; // TV -> server -> phone
const TO_SERVER: Seg[] = [{ id: 'up' }];
const FROM_SERVER: Seg[] = [{ id: 'up', rev: true }];
const TV_TO_SERVER: Seg[] = [{ id: 'down', rev: true }];
const SERVER_TO_TV: Seg[] = [{ id: 'down' }];
const DIRECT: Seg[] = [{ id: 'direct' }];
const DIRECT_BACK: Seg[] = [{ id: 'direct', rev: true }];

function at(ms: number, fn: () => void) { timers.push(setTimeout(fn, ms)); }
function every(ms: number, fn: () => void) { streams.push(setInterval(fn, ms)); }
function stopStreams() { streams.forEach(clearInterval); streams = []; }

function reset() {
  timers.forEach(clearTimeout); timers = [];
  stopStreams();
  packets.forEach((p) => p.el.remove()); packets.length = 0;
  log.value = []; countdown.value = '';
  mode.value = 'connecting'; phoneUp.value = true; tvUp.value = true; blocked.value = false;
}

/** Steady state: 30 Hz-ish input dots, a ping every 2 s, a screen update now and then. */
function flow() {
  stopStreams();
  every(160, () => {
    if (!phoneUp.value || !tvUp.value) return;
    send(mode.value === 'direct' ? DIRECT : UP, mode.value === 'direct' ? 'input' : 'relay', mode.value === 'direct' ? 700 : 1300);
  });
  every(2000, () => {
    if (!phoneUp.value || !tvUp.value) return;
    send(mode.value === 'direct' ? DIRECT_BACK : DOWN, 'ping', mode.value === 'direct' ? 700 : 1300);
    say('TV → phone', `{t:'ping', id:${logSeq + 1}}`, 'ping');
  });
}

function handshake(t: number, then: () => void) {
  at(t, () => { send(TO_SERVER, 'signal', 600); say('phone → server', `{t:'signal', to:'tv', data:{kind:'offer'}}`, 'signal'); });
  at(t + 600, () => send(SERVER_TO_TV, 'signal', 600));
  at(t + 1250, () => { send(TV_TO_SERVER, 'signal', 600); say('TV → server', `{t:'signal', to:'p1', data:{kind:'answer'}}`, 'signal'); });
  at(t + 1850, () => send(FROM_SERVER, 'signal', 600));
  at(t + 2500, then);
}

function goDirect() {
  mode.value = 'direct';
  say('link', `DataChannels 'input' (unordered) + 'state' (reliable) open`, 'input');
  flow();
}

function joinSeq(t: number, rejoin: boolean) {
  at(t, () => {
    send(TO_SERVER, 'signal', 600);
    say('phone → server', rejoin ? `{t:'room.join', code:'KMPV', name:'Asha', rejoinToken}` : `{t:'room.join', code:'KMPV', name:'Asha'}`, 'signal');
  });
  at(t + 650, () => { send(FROM_SERVER, 'signal', 600); say('server → phone', `{t:'room.joined', playerId:'p1', token}`, 'signal'); });
  at(t + 700, () => send(SERVER_TO_TV, 'signal', 600));
}

function run(id: ScenarioId) {
  reset();
  active.value = id;
  if (id === 'home') {
    at(0, () => { send(TV_TO_SERVER, 'signal', 600); say('TV → server', `{t:'room.create', household:'living-room'}`, 'signal'); });
    at(650, () => { send(SERVER_TO_TV, 'signal', 500); say('server → TV', `{t:'room.created', code:'KMPV', tvToken}`, 'signal'); });
    joinSeq(1300, false);
    handshake(2400, goDirect);
    at(7500, () => { send(DIRECT_BACK, 'state', 800); say('TV → phone', `{t:'screen', name:'play', data:{widgets}}`, 'state'); });
    at(11000, () => run('home'));
  } else if (id === 'hotel') {
    joinSeq(0, false);
    at(1300, () => { send(TO_SERVER, 'signal', 600); say('phone → server', `{t:'signal', data:{kind:'offer'}}  ICE can't reach the TV`, 'signal'); });
    at(1900, () => send(SERVER_TO_TV, 'signal', 600));
    // the phone relays input while it waits for the 4 s open timeout
    at(1400, () => { mode.value = 'relay'; mode.value = 'connecting'; flowRelayOnly(); });
    for (let s = 4; s >= 1; s--) at(1400 + (4 - s) * 1000, () => { countdown.value = `${s} s`; });
    at(5400, () => {
      countdown.value = ''; blocked.value = true; mode.value = 'relay';
      say('link', 'OPEN_TIMEOUT_MS (4000) passed: Peer.fail(), relay for good', 'relay');
      flow();
    });
    at(7000, () => {
      say('phone → server', `drawing, 60 KB > RELAY_CHUNK_BYTES: 3 × {t:'~chunk'}`, 'chunk');
      [0, 1, 2].forEach((i) => at(i * 260, () => send(UP, 'chunk', 1500, `${i + 1}/3`)));
    });
    at(8900, () => say('TV', 'Reassembler joins the 3 parts and emits one input frame', 'chunk'));
    at(12500, () => run('hotel'));
  } else if (id === 'refresh') {
    mode.value = 'direct'; flow();
    say('link', 'direct, input flowing at up to 30 Hz', 'input');
    at(1800, () => { phoneUp.value = false; mode.value = 'connecting'; say('phone', 'page reloads, socket closes', 'note'); });
    at(2300, () => { send(SERVER_TO_TV, 'signal', 600); say('server → TV', `{t:'player.left', playerId:'p1'}`, 'signal'); });
    at(3600, () => { phoneUp.value = true; });
    joinSeq(3700, true);
    at(4400, () => say('server → TV', `{t:'player.joined', player:{id:'p1'}}  same seat`, 'signal'));
    handshake(5000, goDirect);
    at(11000, () => run('refresh'));
  } else {
    mode.value = 'direct'; flow();
    say('link', 'direct, input flowing at up to 30 Hz', 'input');
    at(1800, () => { tvUp.value = false; mode.value = 'relay'; say('TV', 'app restarts, sockets and peers drop', 'note'); });
    at(2300, () => { send(FROM_SERVER, 'signal', 600); say('server → phone', `{t:'tv.left'}  reliable sends wait in the queue (max 64)`, 'signal'); });
    at(4000, () => { tvUp.value = true; send(TV_TO_SERVER, 'signal', 600); say('TV → server', `{t:'room.resume', code:'KMPV', tvToken}`, 'signal'); });
    at(4650, () => { send(SERVER_TO_TV, 'signal', 600); say('server → TV', `{t:'room.resumed', players:[{id:'p1'}]}`, 'signal'); });
    at(5300, () => { send(FROM_SERVER, 'signal', 600); say('server → phone', `{t:'tv.back'}  phone re-offers WebRTC`, 'signal'); mode.value = 'connecting'; });
    handshake(6000, goDirect);
    at(12000, () => run('restart'));
  }
}

function flowRelayOnly() {
  stopStreams();
  every(160, () => send(UP, 'relay', 1300));
}

onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  mq = window.matchMedia('(max-width: 640px)');
  pickGeo();
  mq.addEventListener('change', pickGeo);
  raf = requestAnimationFrame(tick);
  vis = new IntersectionObserver(([e]) => {
    const was = onScreen;
    onScreen = !!e?.isIntersecting;
    if (onScreen && !raf) raf = requestAnimationFrame(tick);
    // offscreen, the scenario's timers would keep adding packets and log lines: stop them, replay on return
    if (!onScreen && was) reset();
    if (onScreen && !was) run(active.value);
  });
  if (svg.value) vis.observe(svg.value);
  run(props.scenario ?? 'home');
  watch(() => props.scenario, (id) => { if (id && id !== active.value) run(id); });
});
onBeforeUnmount(() => { reset(); cancelAnimationFrame(raf); vis?.disconnect(); mq?.removeEventListener('change', pickGeo); });
</script>

<template>
  <figure class="cp-diagram" aria-labelledby="cp-diagram-cap">
    <div class="cp-diagram-bar" role="group" aria-label="Network scenario">
      <button
        v-for="s in scenarios" :key="s.id" type="button"
        :aria-pressed="active === s.id" @click="run(s.id); emit('pick', s.id)"
      >{{ s.label }}</button>
    </div>
    <svg ref="svg" class="cp-svg" :viewBox="geo.vb" role="img"
      aria-label="A phone and a TV connected directly by a WebRTC DataChannel, with a WebSocket signaling and relay server between them.">
      <defs>
        <pattern id="cp-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="var(--cp-line)" />
        </pattern>
        <filter id="cp-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#cp-dots)" opacity=".7" />

      <path id="cp-path-up" :d="geo.up" class="cp-route" :class="{ on: mode !== 'direct' }" />
      <path id="cp-path-down" :d="geo.down" class="cp-route" :class="{ on: mode !== 'direct' }" />
      <path id="cp-path-direct" :d="geo.direct" class="cp-direct" :class="{ on: mode === 'direct', blocked }" />
      <text :x="geo.cap[0]" :y="geo.cap[1]" class="cp-cap" :text-anchor="geo.cap[2]">
        {{ blocked ? 'direct path blocked' : 'WebRTC DataChannel' }}
      </text>
      <text v-if="countdown" :x="geo.count[0]" :y="geo.count[1]" class="cp-count" :text-anchor="geo.count[2]">opening… {{ countdown }}</text>
      <g v-if="blocked" class="cp-x" :transform="`translate(${geo.x[0]} ${geo.x[1]})`">
        <path d="M-9 -9 L9 9 M9 -9 L-9 9" />
      </g>

      <g :transform="geo.server">
        <rect width="120" height="52" rx="10" class="cp-box" />
        <text x="60" y="23" text-anchor="middle" class="cp-name">server</text>
        <text x="60" y="40" text-anchor="middle" class="cp-sub">signaling + relay</text>
      </g>

      <g :transform="geo.phone" :class="{ dark: !phoneUp }" class="cp-dev">
        <rect width="116" height="212" rx="20" class="cp-box" />
        <rect x="10" y="14" width="96" height="176" rx="10" class="cp-screen" />
        <circle cx="40" cy="132" r="22" class="cp-stick" />
        <circle cx="44" cy="128" r="9" class="cp-knob" />
        <rect x="64" y="58" width="34" height="34" rx="9" class="cp-btn" />
        <text x="58" y="40" text-anchor="middle" class="cp-sub">{{ phoneUp ? 'Asha (p1)' : 'reloading' }}</text>
        <text x="132" y="206" class="cp-name">phone</text>
      </g>

      <g :transform="geo.tv" :class="{ dark: !tvUp }" class="cp-dev">
        <rect width="176" height="112" rx="10" class="cp-box" />
        <rect x="9" y="9" width="158" height="94" rx="5" class="cp-screen" />
        <text x="88" y="52" text-anchor="middle" class="cp-room">{{ tvUp ? 'KMPV' : '' }}</text>
        <text x="88" y="74" text-anchor="middle" class="cp-sub">{{ tvUp ? 'room code' : 'restarting' }}</text>
        <path d="M70 112 L 62 130 M106 112 L 114 130 M52 130 L 124 130" class="cp-stand" />
        <text x="88" y="152" text-anchor="middle" class="cp-name">TV host</text>
      </g>

      <g ref="layer" filter="url(#cp-glow)" />
    </svg>
    <ul class="cp-legend" aria-label="Legend">
      <li><i class="dot" />input, unordered</li>
      <li><i class="sq rose" />reliable state</li>
      <li><i class="sq amber" />relayed over WebSocket</li>
      <li><i class="sq hollow" />signaling</li>
    </ul>
    <figcaption id="cp-diagram-cap" class="cp-diagram-foot">
      <span class="cp-mode" :data-mode="mode">{{ mode }}</span>
      <span>{{ scenarios.find((s) => s.id === active)?.note }}</span>
    </figcaption>
    <ol class="cp-log" aria-label="Recent protocol messages">
      <li v-for="l in log" :key="l.id" :data-kind="l.kind">
        <span class="cp-log-dir">{{ l.dir }}</span><code>{{ l.text }}</code>
      </li>
    </ol>
  </figure>
</template>
