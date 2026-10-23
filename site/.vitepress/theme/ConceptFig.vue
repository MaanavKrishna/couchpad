<script setup lang="ts">
defineProps<{ kind: 'signaling' | 'channels' | 'fallback' | 'chunking' | 'keepalive' | 'queue' | 'rejoin' | 'resume'; caption?: string }>();
</script>

<template>
  <figure class="cf">
    <svg viewBox="0 0 640 170" role="img" :aria-label="caption">
      <defs>
        <marker id="cf-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
        </marker>
      </defs>

      <!-- shared nodes -->
      <template v-if="kind === 'signaling'">
        <g class="n"><rect x="20" y="60" width="110" height="50" rx="10" /><text x="75" y="90">phone</text></g>
        <g class="n"><rect x="265" y="20" width="110" height="50" rx="10" /><text x="320" y="50">server</text></g>
        <g class="n"><rect x="510" y="60" width="110" height="50" rx="10" /><text x="565" y="90">TV</text></g>
        <path class="l dim" d="M130 75 L262 50" marker-end="url(#cf-a)" /><text class="t" x="185" y="44">room.join, offer</text>
        <path class="l dim" d="M378 50 L508 75" marker-end="url(#cf-a)" /><text class="t" x="455" y="44">signal {from: p1}</text>
        <path class="l cy" d="M132 100 L508 100" marker-end="url(#cf-a)" marker-start="url(#cf-a)" /><text class="t cyt" x="320" y="128">DataChannels, peer to peer</text>
        <text class="t" x="320" y="155">the server stamps from; phones may only address 'tv'</text>
      </template>

      <template v-else-if="kind === 'channels'">
        <g class="n"><rect x="20" y="55" width="110" height="60" rx="10" /><text x="75" y="90">phone</text></g>
        <g class="n"><rect x="510" y="55" width="110" height="60" rx="10" /><text x="565" y="90">TV</text></g>
        <path class="l cy" d="M130 70 L508 70" marker-end="url(#cf-a)" />
        <circle v-for="x in [170, 230, 300, 350, 420, 470]" :key="x" :cx="x" cy="70" r="5" class="dot cyf" />
        <text class="t cyt" x="320" y="50">'input': ordered false, maxRetransmits 0</text>
        <path class="l ro" d="M130 104 L508 104" marker-end="url(#cf-a)" marker-start="url(#cf-a)" />
        <rect v-for="x in [200, 330, 440]" :key="x" :x="x - 7" y="97" width="14" height="14" rx="3" class="rof" />
        <text class="t rot" x="320" y="135">'state': ordered, reliable (swipe, vote, text, draw, screen, ping)</text>
        <text class="t" x="320" y="160">a late stick sample is worse than a lost one</text>
      </template>

      <template v-else-if="kind === 'fallback'">
        <g class="n"><rect x="20" y="90" width="110" height="50" rx="10" /><text x="75" y="120">phone</text></g>
        <g class="n"><rect x="265" y="15" width="110" height="46" rx="10" /><text x="320" y="43">relay</text></g>
        <g class="n"><rect x="510" y="90" width="110" height="50" rx="10" /><text x="565" y="120">TV</text></g>
        <path class="l ro dash" d="M132 115 L508 115" />
        <path class="x" d="M310 105 l20 20 M330 105 l-20 20" />
        <text class="t rot" x="320" y="152">no DataChannel within 4 s, failed, or disconnected over 2 s</text>
        <path class="l am" d="M110 88 Q 150 40 262 38" marker-end="url(#cf-a)" />
        <path class="l am" d="M378 38 Q 490 40 530 88" marker-end="url(#cf-a)" />
        <text class="t amt" x="150" y="28">relay {to: 'tv'}</text>
        <text class="t amt" x="490" y="28">relay {from}</text>
      </template>

      <template v-else-if="kind === 'chunking'">
        <rect x="20" y="40" width="150" height="56" rx="8" class="amf" /><text x="95" y="73" class="tk">60 KB message</text>
        <path class="l dim" d="M175 68 L225 68" marker-end="url(#cf-a)" />
        <g v-for="(y, i) in [20, 64, 108]" :key="i">
          <rect x="235" :y="y" width="150" height="36" rx="7" class="amo" />
          <text x="310" :y="y + 23" class="t amt">~chunk seq {{ i }}, total 3</text>
        </g>
        <path class="l dim" d="M390 68 L440 68" marker-end="url(#cf-a)" />
        <rect x="450" y="40" width="170" height="56" rx="8" class="amf" /><text x="535" y="73" class="tk">reassembled</text>
        <text class="t" x="320" y="162">each envelope under 28 KB, at most 64 per message, partials expire after 10 s</text>
      </template>

      <template v-else-if="kind === 'keepalive'">
        <path class="l dim" d="M30 120 L610 120" />
        <rect x="60" y="40" width="380" height="18" rx="9" class="cyo" /><text x="250" y="34" class="t cyt">button held</text>
        <g v-for="x in [60, 120, 180, 240, 300, 360, 420]" :key="x">
          <line :x1="x" y1="70" :x2="x" y2="118" class="tick cy" /><circle :cx="x" cy="70" r="5" class="cyf" />
        </g>
        <text class="t" x="240" y="142">a resend every 100 ms</text>
        <g v-for="x in [440, 470]" :key="x"><line :x1="x" y1="80" :x2="x" y2="118" class="tick ro" /><circle :cx="x" cy="80" r="6" class="rof" /></g>
        <text class="t rot" x="492" y="84" style="text-anchor: start">release × 2, 30 ms apart</text>
        <text class="t" x="530" y="142">blur or hidden tab: zeroed frame</text>
      </template>

      <template v-else-if="kind === 'queue'">
        <g class="n"><rect x="20" y="55" width="110" height="60" rx="10" /><text x="75" y="90">send()</text></g>
        <g v-for="i in 8" :key="i"><rect :x="160 + (i - 1) * 34" y="60" width="28" height="50" rx="5" class="rof" :opacity="1 - i * 0.07" /></g>
        <text class="t" x="290" y="140">bounded queue, up to 64, in order</text>
        <path class="l dim" d="M440 85 L500 85" marker-end="url(#cf-a)" />
        <g class="n"><rect x="510" y="55" width="110" height="60" rx="10" /><text x="565" y="90">link back</text></g>
        <text class="t rot" x="290" y="40">socket down, no DataChannel</text>
        <text class="t" x="565" y="140">flushes in order</text>
      </template>

      <template v-else-if="kind === 'rejoin'">
        <g class="n"><rect x="20" y="55" width="120" height="60" rx="10" /><text x="80" y="90">phone</text></g>
        <g class="n"><rect x="265" y="55" width="110" height="60" rx="10" /><text x="320" y="90">server</text></g>
        <path class="l dim" d="M262 70 L142 70" marker-end="url(#cf-a)" /><text class="t" x="200" y="50">token</text>
        <rect x="20" y="128" width="120" height="24" rx="6" class="amo" /><text x="80" y="145" class="t amt">sessionStorage</text>
        <path class="l cy" d="M142 100 L262 100" marker-end="url(#cf-a)" /><text class="t cyt" x="200" y="124">join + rejoinToken</text>
        <path class="l dim" d="M378 85 L508 85" marker-end="url(#cf-a)" />
        <g class="n"><rect x="510" y="55" width="110" height="60" rx="10" /><text x="565" y="84">TV</text><text x="565" y="102" class="t cyt">same p1</text></g>
        <text class="t" x="445" y="70">player.joined</text>
      </template>

      <template v-else>
        <g class="n dimn"><rect x="20" y="20" width="110" height="50" rx="10" /><text x="75" y="50">TV restarts</text></g>
        <g class="n"><rect x="265" y="60" width="110" height="50" rx="10" /><text x="320" y="90">server</text></g>
        <g class="n"><rect x="510" y="60" width="110" height="50" rx="10" /><text x="565" y="90">phones</text></g>
        <path class="l ro" d="M378 75 L508 75" marker-end="url(#cf-a)" /><text class="t rot" x="445" y="62">1. tv.left</text>
        <path class="l am" d="M110 72 Q 150 120 262 100" marker-end="url(#cf-a)" /><text class="t amt" x="130" y="135">2. room.resume + tvToken</text>
        <path class="l dim" d="M265 70 Q 180 30 134 40" marker-end="url(#cf-a)" /><text class="t" x="225" y="20">3. room.resumed {players}</text>
        <path class="l cy" d="M378 100 L508 100" marker-end="url(#cf-a)" /><text class="t cyt" x="445" y="125">4. tv.back, re-offer</text>
      </template>
    </svg>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.cf { margin: 18px 0 22px; padding: 14px 10px 10px; border: 1px solid var(--cp-line); border-radius: 14px;
  background: radial-gradient(120% 120% at 50% 0%, rgba(76,201,240,.05), transparent 60%), #0b0d1c; }
.cf svg { display: block; width: 100%; height: auto; color: var(--cp-dim); overflow: visible; }
.cf figcaption { margin: 8px 6px 0; font-size: .84rem; color: var(--cp-dim); }
.n rect { fill: var(--cp-raise); stroke: var(--cp-line); stroke-width: 1.5; }
.n text { fill: var(--cp-text); font: 600 15px var(--cp-display); text-anchor: middle; }
.dimn { opacity: .55; }
.t { fill: var(--cp-muted); font: 12.5px var(--vp-font-family-base); text-anchor: middle; }
.tk { fill: #1a1300; font: 700 14px var(--cp-display); text-anchor: middle; }
.l { fill: none; stroke-width: 2; }
.dim { stroke: var(--cp-dim); color: var(--cp-dim); }
.cy { stroke: var(--cp-cyan); color: var(--cp-cyan); }
.ro { stroke: var(--cp-rose); color: var(--cp-rose); }
.am { stroke: var(--cp-amber); color: var(--cp-amber); }
.dash { stroke-dasharray: 5 7; opacity: .7; }
.tick { stroke-width: 1.5; opacity: .6; }
.cyt { fill: var(--cp-cyan); } .rot { fill: var(--cp-rose); } .amt { fill: var(--cp-amber); }
.cyf { fill: var(--cp-cyan); } .rof { fill: var(--cp-rose); } .amf { fill: var(--cp-amber); }
.cyo { fill: rgba(76,201,240,.12); stroke: var(--cp-cyan); stroke-width: 1.5; }
.amo { fill: rgba(255,209,102,.1); stroke: var(--cp-amber); stroke-width: 1.5; }
.x { stroke: var(--cp-rose); stroke-width: 3.5; stroke-linecap: round; fill: none; }
@media (max-width: 640px) { .cf { overflow-x: auto; } .cf svg { min-width: 560px; } }
</style>
