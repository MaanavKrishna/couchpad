# couchpad

**Phones as game controllers for TV and web games.** Players scan a QR code, their phone becomes a gamepad (joystick, buttons, tilt, swipe, draw pad, vote, text), and the inputs stream to your game over a direct WebRTC DataChannel, with an automatic WebSocket relay fallback when the direct path is not available.

couchpad was extracted from [Cadabra](https://github.com/MaanavKrishna/cadabra), a Fire TV party game, where it carries every tap and stick wiggle from up to four phones to a Fire TV Stick HD (measured 13 to 16 ms on a home network).

- **Direct first, relay always works.** The phone offers a WebRTC connection through your signaling server. If the DataChannel opens within 4 s, inputs go peer-to-peer on the local network. If not (strict Wi-Fi, client isolation), everything silently falls back to relaying through the WebSocket, including large payloads (chunked to fit 32 KB frames).
- **Two channels.** Continuous input (stick, tilt, held buttons) goes on an unordered, no-retransmit channel; one-shots (swipe, vote, text, drawings) and state go on a reliable one.
- **Built for flaky phones.** Reconnect with jittered backoff, rejoin tokens so a refreshed phone gets its seat back, host resume after a TV app restart, a bounded reliable queue while links are down, keepalive resends while a control is held, doubled button releases, and a zeroing frame on blur/hide so nothing sticks "pressed".
- **Framework-free widgets.** `mountController()` turns a declarative widget list into touch controls with pointer-capture, haptics, and CSS-variable theming.
- **Tiny.** One runtime dependency (`zod`). All environment access (WebSocket, RTCPeerConnection, clock, storage) is injectable, so it is fully unit-tested without a browser.

## Install

Not yet published to npm. Use it from git or copy `src/`:

```bash
npm install github:MaanavKrishna/couchpad
```

It is shipped as TypeScript source (`main: src/index.ts`); bundle it with Vite, esbuild, or similar.

## Quick start

**Host (TV / big screen):**

```ts
import { CouchHost } from 'couchpad';

const host = new CouchHost({ wsUrl: 'wss://your-signaling-server/ws', household: 'living-room' });
const { code } = await host.create();          // show `code` / a QR to https://your-site/?room=CODE

host.on('player', (id, info) => {
  host.sendTo(id, { t: 'screen', name: 'play', data: { widgets: [
    { kind: 'joystick', id: 'move' }, { kind: 'button', id: 'jump', label: 'JUMP' },
  ] } });
});
host.on('input', (playerId, frame) => { /* frame.axes, frame.buttons, frame.swipe, ... */ });
host.on('left', (playerId) => { /* phone disconnected */ });
```

**Phone (served over HTTPS so tilt, vibration and wake-lock work):**

```ts
import { CouchClient, mountController } from 'couchpad';

const client = new CouchClient({ wsUrl: 'wss://your-signaling-server/ws' });
let unmount: (() => void) | undefined;

client.onMessage((m) => {
  if (m.t !== 'screen') return;
  unmount?.();
  unmount = mountController(document.body, m.data.widgets, (frame) => client.sendInput(frame));
});

await client.join('ABCD', 'Maanav');            // client.mode is 'direct' or 'relay'
```

A complete runnable example (reference server + host page + phone page) lives in [`examples/`](examples). Try it:

```bash
npm install
npm run example        # http://localhost:8787  (open /phone.html?room=CODE on a phone on the same Wi-Fi)
```

## API

### `CouchHost`

| Member | Description |
|---|---|
| `new CouchHost({ wsUrl, household, transport?, iceServers?, storage?, ... })` | `transport: 'relay-only'` skips WebRTC. Default ICE server is Google's public STUN; pass your own for production. |
| `create()` / `resume(code?)` | Create a room, or reclaim one after a restart (the TV token is kept in `sessionStorage`). Resolves `{ code }`. |
| `sendTo(playerId, msg)` / `broadcast(msg)` | Reliable send over the DataChannel, else relay (chunked), else queued (max 64). Returns `false` if undeliverable. |
| `players()` | `Map<id, { name, avatar, connected, transport: 'direct' \| 'relay', rttMs }>` |
| `on('player' \| 'left' \| 'input' \| 'msg' \| 'resumed' \| 'error', cb)` | `input` delivers validated `InputFrame`s, stale continuous frames are dropped. |
| `close()` | Tear everything down. |

### `CouchClient` (phone)

| Member | Description |
|---|---|
| `new CouchClient({ wsUrl, transport?, inputHz?, ... })` | Input is throttled to 30 Hz by default; held inputs are resent every 100 ms. |
| `join(code, name)` | Resolves `{ playerId }`. Rejoin tokens are stored per room code. Rejects with `room.notFound`, `room.full`, `join.timeout`, ... |
| `sendInput(frame)` | Continuous frames use the unreliable channel; frames with `swipe`/`vote`/`text`/`draw` are one-shots on the reliable path. |
| `send(msg)` / `onMessage(cb)` | Reliable app messages to and from the host. |
| `mode`, `rttMs()` | Current transport and measured round trip. |
| `on('mode' \| 'tv.left' \| 'tv.back' \| 'link' \| 'error', cb)` | Link status events. |

### Widgets

`mountController(el, widgets, onFrame, opts?)` returns an `unmount()` function. Widget kinds: `joystick`, `button`, `hold`, `tilt`, `swipe`, `draw` (outputs a small PNG/JPEG data URL), `vote`, `text`. Style them with CSS variables: `--cp-primary`, `--cp-accent`, `--cp-glow`, `--cp-text`, `--cp-surface`, `--cp-font`, `--cp-display-font`. Individual `createJoystick`, `createButton`, ... factories are exported too. Zod schemas for everything on the wire (`InputFrameSchema`, `ControlWidgetSchema`, `PeerMsgSchema`) are exported so a host can validate untrusted widget lists.

## Signaling protocol

couchpad does not ship a server; it expects a small WebSocket JSON protocol. Every message is a JSON object with a string `t`. The server must identify the host connection as `'tv'` and phones by a server-assigned `playerId`.

**Client to server**

| Message | From | Meaning |
|---|---|---|
| `{t:'room.create', household?}` | host | Make a room. |
| `{t:'room.resume', code, tvToken}` | host | Reclaim a room after reconnect. |
| `{t:'room.join', code, name, rejoinToken?}` | phone | Join, or take back a seat with the token. |
| `{t:'signal', to, data}` | both | WebRTC offer/answer/candidate. Phones always send `to:'tv'`; the host sends `to:<playerId>`. |
| `{t:'relay', to?, data}` | both | Fallback transport. Same addressing as `signal`. |
| `{t:'ping'}` | both | Keepalive; answer `{t:'pong'}`. |

**Server to client**

| Message | To | Meaning |
|---|---|---|
| `{t:'room.created', code, tvToken}` | host | `code` is 4 letters from `BCDFGHJKLMNPQRSTVWXZA`. |
| `{t:'room.resumed', players?:[{id,name,avatar?}]}` | host | The live player list is the truth after a resume. |
| `{t:'room.joined', playerId, token, name}` | phone | `token` is the rejoin token. |
| `{t:'player.joined', player}` / `{t:'player.left', playerId}` | host | Presence. |
| `{t:'tv.left'}` / `{t:'tv.back'}` | phones | Host presence; phones re-offer WebRTC on `tv.back`. |
| `{t:'signal' \| 'relay', from, data}` | either | `from` is `'tv'` or a `playerId`. Servers must set it, never trust the sender. |
| `{t:'error', code, message?}` | either | `room.notFound`, `room.full`, `room.badToken`, `room.targetGone`, `room.rateLimited`, ... |

Additional server messages (for example game-specific events) are ignored by couchpad, so you can multiplex your own on the same socket.

**Peer messages** (inside the DataChannel or inside `relay.data`): `{t:'input', frame}`, `{t:'screen', name, data?}`, `{t:'ping', id}`, `{t:'pong', id}`. An `InputFrame` is `{ t, axes?, buttons?, tilt?, swipe?, draw?, vote?, text? }`.

**Relay chunking.** API Gateway-style WebSocket frames cap near 32 KB, so relay payloads larger than 28 KB are split into `{t:'~chunk', id, seq, total, part}` envelopes and reassembled per sender (partials expire after 10 s). Your server just forwards `relay.data` as is.

[`examples/server/server.mjs`](examples/server/server.mjs) is a ~100 line reference implementation with `ws`. Cadabra's production version runs on API Gateway WebSocket, Lambda and DynamoDB.

## Development

```bash
npm install
npm test          # 34 tests: transport state machine, reconnects, chunking, widgets (jsdom), example server round trip
npm run typecheck
```

## License

MIT, copyright 2026 Maanav Krishna.
