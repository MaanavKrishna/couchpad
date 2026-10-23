# Getting started

In this tutorial you run a signaling server, put a room code on a "TV" page, join it from your phone and watch joystick input arrive. It takes about five minutes.

You need Node 20 or newer and a phone on the same Wi-Fi as your computer.

::: info How the pieces fit
**TV page** (`CouchHost`) and **phone page** (`CouchClient`) each open a WebSocket to your **signaling server**. The server introduces them, then the phone opens a WebRTC DataChannel straight to the TV. When that fails, the server relays.
:::

## 1. Install

couchpad is not on npm yet. Install it from GitHub:

```bash
npm install github:MaanavKrishna/couchpad
```

It ships as TypeScript source (`"main": "src/index.ts"`), so bundle it with Vite, esbuild or Rollup. Its only runtime dependency is `zod`.

## 2. Start a signaling server

The fastest way is the example server in the repo. It is about 100 lines on top of `ws` and implements the full [protocol](./protocol).

```bash
git clone https://github.com/MaanavKrishna/couchpad
cd couchpad && npm install
npm run example
```

<div class="out">built examples/dist
couchpad example on http://localhost:8787  (phone: /phone.html)</div>

Leave it running. The rest of this tutorial uses `ws://<your-computer-ip>:8787/ws` as the WebSocket URL. To run your own server later, see [Deploy the signaling server](./guides/deploy-server).

## 3. Create a room on the TV

The host creates a room, shows its code, and tells each phone which controls to draw.

::: code-group

```ts [tv.ts]
import { CouchHost } from 'couchpad';

const host = new CouchHost({ wsUrl: 'ws://192.168.1.20:8787/ws', household: 'living-room' });

const { code } = await host.create();
document.querySelector('#code')!.textContent = code;   // e.g. "KMPV"
// Production apps encode https://your-site/phone.html?room=KMPV as a QR code.

host.on('player', (id: string, info: { name: string }) => {
  console.log('joined', id, info.name);
  host.sendTo(id, {
    t: 'screen',
    name: 'play',
    data: { widgets: [{ kind: 'joystick', id: 'move' }, { kind: 'button', id: 'jump', label: 'JUMP' }] },
  });
});
```

```html [tv.html]
<!doctype html>
<h1>Room <span id="code">…</span></h1>
<script type="module" src="./tv.ts"></script>
```

:::

Serve both pages with any dev server, for example `npx vite --host`, and open the TV page on your computer.

<div class="out">Room KMPV</div>

## 4. Join from the phone

The phone joins with the code from its URL and renders whatever screen the host sends.

::: code-group

```ts [phone.ts]
import { CouchClient, mountController, type ControlWidget } from 'couchpad';

const client = new CouchClient({ wsUrl: 'ws://192.168.1.20:8787/ws' });
let unmount: (() => void) | undefined;

client.onMessage((m) => {
  if (m.t !== 'screen') return;
  unmount?.();
  const { widgets } = m.data as { widgets: ControlWidget[] };
  unmount = mountController(document.querySelector('#pad')!, widgets, (f) => client.sendInput(f));
});

client.on('mode', (mode: 'direct' | 'relay') => console.log('transport:', mode));

const room = new URLSearchParams(location.search).get('room') ?? '';
const { playerId } = await client.join(room, 'Asha');
console.log('joined as', playerId);
```

```html [phone.html]
<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>html, body, #pad { margin: 0; height: 100%; background: #0d0f1e; }</style>
<div id="pad"></div>
<script type="module" src="./phone.ts"></script>
```

:::

On the phone, open `http://<your-computer-ip>:<port>/phone.html?room=KMPV`.

<div class="out">joined as p1
transport: direct</div>

The TV logs the new player:

<div class="out">joined p1 Asha</div>

::: tip Direct or relay?
`transport: direct` means the DataChannel opened. On networks with client isolation you will see nothing for 4 s and then stay on `relay`. Both work; see [relay fallback](./concepts#relay-fallback).
:::

## 5. Read the first input

Add an `input` listener on the TV, then move the stick on the phone.

```ts [tv.ts]
host.on('input', (id: string, frame) => {
  console.log(id, frame.axes, frame.buttons);
});
```

<div class="out">p1 { x: 0.42, y: -0.87 } { jump: false }
p1 { x: 0.44, y: -0.85 } { jump: false }
p1 { x: 0, y: 0 } { jump: true }</div>

Continuous frames arrive at up to 30 per second, a button press arrives immediately, and while you hold a control the phone resends it every 100 ms. When you let go or switch tabs, a zeroed frame arrives so nothing stays pressed.

## 6. Survive a reload

Refresh the phone page. It rejoins with the token couchpad stored in `sessionStorage`, and the TV sees the same `p1`. To survive a TV reload too, resume before creating:

```ts [tv.ts]
const { code } = await host.resume().catch(() => host.create());
```

::: warning Serve the phone page over HTTPS in production
Tilt (DeviceOrientation), vibration and wake lock need a secure context. `localhost` counts as secure; a LAN IP does not.
:::

## What you built

- A **room** on the TV with a 4-letter code, created through your signaling server.
- A **phone controller** with a joystick and a button, drawn by `mountController()` from a list the TV sent.
- An **input stream** that goes peer to peer when it can and through the relay when it can't, with no change to your code.
- **Reconnection** for free: a refreshed phone keeps its seat, and `resume()` keeps the room across a TV reload.

## Next steps

- Build a real game: [Two-player paddle game](./guides/paddle-game).
- Understand the transport: [Concepts](./concepts).
- Put your server online: [Deploy the signaling server](./guides/deploy-server).
