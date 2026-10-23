# Getting started

couchpad has two halves. The **host** runs on the big screen (a TV app, a browser tab on a laptop plugged into a TV, a WebView on Fire TV). The **client** runs in the phone's browser. A small WebSocket server sits between them for signaling and, when needed, relaying.

```
phone (CouchClient) ──ws──► signaling server ◄──ws── TV (CouchHost)
        └─────────── WebRTC DataChannels ───────────┘
```

## Install

couchpad is not on npm yet. Install it from GitHub:

```bash
npm install github:MaanavKrishna/couchpad
```

It ships as TypeScript source (`"main": "src/index.ts"`), so bundle it with Vite, esbuild, Rollup or similar. Its only runtime dependency is `zod`.

::: tip You also need a server
couchpad speaks a small JSON protocol over WebSocket but does not ship a production server. The [example server](./example-server) is about 100 lines and is a good starting point. The full message list is in [Protocol messages](./protocol).
:::

## Host side (the TV)

Create a `CouchHost`, create a room, and show its code. Most apps encode a join URL like `https://your-site/?room=KMPV` as a QR code.

```ts
import { CouchHost } from 'couchpad';

const host = new CouchHost({
  wsUrl: 'wss://your-server/ws',
  household: 'living-room',
});

const { code } = await host.create();
showQr(`https://your-site/phone.html?room=${code}`);

// Tell each new phone which controls to draw.
host.on('player', (id: string, info: { name: string }) => {
  host.sendTo(id, {
    t: 'screen',
    name: 'play',
    data: {
      widgets: [
        { kind: 'joystick', id: 'move' },
        { kind: 'button', id: 'jump', label: 'JUMP' },
      ],
    },
  });
});

// Validated InputFrames arrive here, stale continuous frames already dropped.
host.on('input', (id: string, frame) => {
  if (frame.axes) movePlayer(id, frame.axes.x, frame.axes.y);
  if (frame.buttons?.jump) jump(id);
});

host.on('left', (id: string) => greyOut(id));
```

If the TV app reloads, call `resume()` instead of `create()` to reclaim the same room. The TV token is kept in `sessionStorage` by default:

```ts
const { code } = await host.resume().catch(() => host.create());
```

## Phone side

The phone page creates a `CouchClient`, joins with the code from the URL and renders whatever `screen` the host sends.

```ts
import { CouchClient, mountController, type ControlWidget } from 'couchpad';

const client = new CouchClient({ wsUrl: 'wss://your-server/ws' });
let unmount: (() => void) | undefined;

client.onMessage((m) => {
  if (m.t !== 'screen') return;
  unmount?.();
  const { widgets } = m.data as { widgets: ControlWidget[] };
  unmount = mountController(document.getElementById('root')!, widgets, (f) => client.sendInput(f));
});

client.on('mode', (mode: 'direct' | 'relay') => console.log('transport', mode));

const room = new URLSearchParams(location.search).get('room') ?? '';
await client.join(room, 'Asha');
```

`join()` rejects with an `Error` whose message is the server error code, for example `room.notFound`, `room.full` or `join.timeout` (after 8 s).

::: warning Serve the phone page over HTTPS
Tilt (DeviceOrientation), vibration and wake lock need a secure context. `localhost` counts as secure, a LAN IP does not.
:::

## What happens next

1. The phone joins over WebSocket and gets a `playerId` and a rejoin token.
2. It offers WebRTC to the TV through the server. Until the DataChannels open, input is relayed so nothing waits.
3. If both channels open within 4 s, input goes peer to peer. Otherwise the link stays on the relay.
4. If the phone refreshes or the TV restarts, both sides reconnect and get their seat and room back.

[Concepts](./concepts) explains each step in detail.
