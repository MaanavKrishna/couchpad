---
layout: page
sidebar: false
title: couchpad
titleTemplate: Phones as game controllers, no app
---

<HomeHero />

<section class="cp-session" aria-labelledby="cp-session-h">
<div class="cp-wrap">
<h2 id="cp-session-h" class="cp-h2">Watch a session survive the network</h2>
<p class="cp-sub-lede">Pick a network and watch what couchpad sends. Every message in the log is a real couchpad message.</p>
<LinkDiagram />
</div>
</section>

<HomeSpecs />

<section class="cp-quick" aria-labelledby="cp-quick-h">
<div class="cp-wrap">
<h2 id="cp-quick-h" class="cp-h2">Quick start</h2>
<p class="cp-sub-lede">The TV creates a room and tells each phone which controls to show. The phone renders them and streams input back.</p>
<div class="vp-doc">

::: code-group

```ts [tv.ts]
import { CouchHost } from 'couchpad';

const host = new CouchHost({ wsUrl: 'wss://your-server/ws', household: 'living-room' });
const { code } = await host.create(); // show a QR to https://your-site/?room=CODE

host.on('player', (id: string) => host.sendTo(id, {
  t: 'screen', name: 'play',
  data: { widgets: [{ kind: 'joystick', id: 'move' }, { kind: 'button', id: 'jump', label: 'JUMP' }] },
}));
host.on('input', (id: string, frame) => console.log(id, frame.axes, frame.buttons));
```

```ts [phone.ts]
import { CouchClient, mountController, type ControlWidget } from 'couchpad';

const client = new CouchClient({ wsUrl: 'wss://your-server/ws' });
client.onMessage((m) => {
  if (m.t !== 'screen') return;
  const { widgets } = m.data as { widgets: ControlWidget[] };
  mountController(document.body, widgets, (f) => client.sendInput(f));
});

const room = new URLSearchParams(location.search).get('room')!;
await client.join(room, 'Asha'); // client.mode is now 'direct' or 'relay'
```

```bash [install]
npm install github:MaanavKrishna/couchpad
```

:::

</div>
<div class="cp-more">

[Read the full getting started guide](/docs/getting-started)

</div>
</div>
</section>

<HomeCadabra />
