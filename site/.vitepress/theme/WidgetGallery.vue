<script setup lang="ts">
const items = [
  { kind: 'joystick', code: "{ kind: 'joystick', id: 'move' }", emits: 'axes: { x, y }' },
  { kind: 'button', code: "{ kind: 'button', id: 'jump', label: 'JUMP' }", emits: 'buttons.jump' },
  { kind: 'hold', code: "{ kind: 'hold', id: 'charge', label: 'CHARGE' }", emits: 'buttons.charge' },
  { kind: 'tilt', code: "{ kind: 'tilt', id: 'steer' }", emits: 'tilt: { x, y }' },
  { kind: 'swipe', code: "{ kind: 'swipe', id: 'dir' }", emits: "swipe: 'left'" },
  { kind: 'draw', code: "{ kind: 'draw', id: 'pic', prompt: 'Draw a cat' }", emits: 'draw: data URL' },
  { kind: 'vote', code: "{ kind: 'vote', id: 'v', options: ['Red', 'Blue', 'Green'] }", emits: 'vote: 1' },
  { kind: 'text', code: "{ kind: 'text', id: 'name', placeholder: 'Team name' }", emits: "text: 'Owls'" },
];
</script>

<template>
  <ul class="wg">
    <li v-for="w in items" :key="w.kind" class="wg-item">
      <div class="wg-phone" aria-hidden="true">
        <template v-if="w.kind === 'joystick'"><div class="wg-pad"><i class="wg-knob" /></div></template>
        <template v-else-if="w.kind === 'button'"><div class="wg-btn">JUMP</div></template>
        <template v-else-if="w.kind === 'hold'"><div class="wg-btn hold"><span class="wg-charge" /><span class="wg-lbl">CHARGE</span></div></template>
        <template v-else-if="w.kind === 'tilt'"><div class="wg-tilt"><i /></div><small>Steer by tilting</small></template>
        <template v-else-if="w.kind === 'swipe'"><div class="wg-swipe"><b>↑</b><b>←</b><b>→</b><b>↓</b></div></template>
        <template v-else-if="w.kind === 'draw'">
          <small>Draw a cat</small>
          <svg class="wg-canvas" viewBox="0 0 100 70"><path d="M30 50 Q 28 20 40 22 L46 30 L54 30 L60 22 Q 72 20 70 50 Q 50 62 30 50" /><path d="M42 40h.1M58 40h.1" /></svg>
          <div class="wg-swatches"><i /><i /><i /><i /></div>
        </template>
        <template v-else-if="w.kind === 'vote'"><div class="wg-vote"><span>Red</span><span class="on">Blue</span><span>Green</span></div></template>
        <template v-else><div class="wg-text"><span>Owls</span><em>4/40</em></div><div class="wg-send">Send</div></template>
      </div>
      <div class="wg-meta">
        <strong>{{ w.kind }}</strong>
        <code>{{ w.code }}</code>
        <span>emits <code>{{ w.emits }}</code></span>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.wg { list-style: none; padding: 0; margin: 20px 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.wg-item { margin: 0; border: 1px solid var(--cp-line); border-radius: 16px; overflow: hidden; background: var(--cp-panel); display: flex; flex-direction: column; }
.wg-phone { height: 170px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  background: radial-gradient(100% 80% at 50% 100%, rgba(124,92,255,.14), transparent 70%), #0a0c1a; border-bottom: 1px solid var(--cp-line); }
.wg-phone small { color: var(--cp-muted); font-size: .8rem; }
.wg-meta { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px; font-size: .82rem; color: var(--cp-muted); }
.wg-meta strong { font: 700 1rem var(--cp-display); color: var(--cp-text); }
.wg-meta code { font: .76rem var(--vp-font-family-mono); color: var(--cp-text); background: none; padding: 0; overflow-wrap: anywhere; }
.wg-meta span code { color: var(--cp-cyan); }
.wg-pad { width: 110px; height: 110px; border-radius: 50%; border: 2px solid rgba(124,92,255,.5); display: grid; place-items: center; background: rgba(255,255,255,.04); }
.wg-knob { width: 44px; height: 44px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #b9a8ff, #7c5cff); transform: translate(16px, -12px); box-shadow: 0 0 20px rgba(143,107,255,.6); }
.wg-btn { position: relative; overflow: hidden; width: 140px; height: 64px; border-radius: 18px; display: grid; place-items: center; font: 800 1rem var(--cp-display); color: #fff; background: #7c5cff; box-shadow: 0 6px 0 #4c33b3; letter-spacing: .05em; }
.wg-btn.hold { background: #2b2350; box-shadow: 0 6px 0 #17122f; }
.wg-charge { position: absolute; inset: 0 40% 0 0; background: linear-gradient(90deg, #ffb547, #ff8f47); opacity: .85; z-index: 0; }
.wg-lbl { position: relative; }
.wg-tilt { width: 120px; height: 76px; border-radius: 14px; border: 2px solid rgba(124,92,255,.5); position: relative; transform: perspective(300px) rotateY(-18deg) rotateX(8deg); }
.wg-tilt i { position: absolute; left: 60%; top: 40%; width: 18px; height: 18px; border-radius: 50%; background: #ffb547; box-shadow: 0 0 14px rgba(255,181,71,.7); }
.wg-swipe { width: 120px; height: 120px; border-radius: 18px; border: 2px dashed rgba(124,92,255,.5); display: grid; grid-template-areas: '. u .' 'l . r' '. d .'; place-items: center; color: var(--cp-muted); font-size: 1.1rem; }
.wg-swipe b:nth-child(1) { grid-area: u; } .wg-swipe b:nth-child(2) { grid-area: l; color: #ffb547; } .wg-swipe b:nth-child(3) { grid-area: r; } .wg-swipe b:nth-child(4) { grid-area: d; }
.wg-canvas { width: 130px; height: 86px; border-radius: 10px; background: #14141f; fill: none; stroke: #fff; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.wg-swatches { display: flex; gap: 6px; }
.wg-swatches i { width: 16px; height: 16px; border-radius: 50%; background: #fff; }
.wg-swatches i:nth-child(2) { background: #ff4d6d; } .wg-swatches i:nth-child(3) { background: #ffd166; } .wg-swatches i:nth-child(4) { background: #4cc9f0; }
.wg-vote { display: flex; flex-direction: column; gap: 6px; width: 150px; }
.wg-vote span { padding: 7px 12px; border-radius: 10px; background: rgba(255,255,255,.06); color: var(--cp-text); font-size: .85rem; }
.wg-vote span.on { background: #7c5cff; color: #fff; }
.wg-text { width: 160px; display: flex; justify-content: space-between; padding: 9px 12px; border-radius: 10px; background: rgba(255,255,255,.06); color: var(--cp-text); font-size: .9rem; }
.wg-text em { font-style: normal; color: var(--cp-muted); font-size: .75rem; }
.wg-send { padding: 6px 16px; border-radius: 10px; background: #7c5cff; color: #fff; font-weight: 600; font-size: .85rem; }
</style>
