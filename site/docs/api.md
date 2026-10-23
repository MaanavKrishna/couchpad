---
outline: [2, 3]
---

# API reference

Everything below is exported from the package root. Signatures are copied from `src/`, and each heading has a link you can copy with the `#` next to it.

```ts
import { CouchHost, CouchClient, mountController } from 'couchpad';
```

| Module | Exports |
|---|---|
| [`host.ts`](#couchhost) | `CouchHost`, `CouchHostOpts`, `PlayerView`, `TV_TOKEN_KEY`, `LAST_ROOM_KEY` |
| [`client.ts`](#couchclient) | `CouchClient`, `CouchClientOpts`, `Transport`, `TransportPolicy`, timing constants |
| [`peer.ts`](#peer) | `Peer`, `PeerOpts`, `Mode`, `SignalData`, `RTCLike`, `ChannelLike`, `RTCCtor`, ICE constants |
| [`signaling.ts`](#signaling) | `Signaling`, `SignalingOpts`, `Clock`, `defaultClock`, `StorageLike`, `defaultStorage`, `WebSocketLike`, backoff constants |
| [`util.ts`](#relay-utilities) | `relayPayloads`, `tooLargeForRelay`, `Reassembler`, `parsePeerMsg`, `BoundedQueue`, `Emitter`, size constants |
| [`types.ts`](#types-and-schemas) | `InputFrame`, `ControlWidget`, `PeerMsg`, their zod schemas, wire types, `ROOM_CODE_RE` |
| [`widgets/`](./widgets) | `mountController` and the widget factories, on their own page |

## CouchHost

The TV side. Owns the room, answers each phone's WebRTC offer and relays when direct is down.

```ts
class CouchHost {
  code?: string;
  constructor(opts: CouchHostOpts);
}
```

### new CouchHost(opts)

| Option | Type | Default | Description |
|---|---|---|---|
| `wsUrl` | `string` | required | Signaling server WebSocket URL |
| `household` | `string` | required | Sent with `room.create` |
| `WebSocket` | `WebSocketCtor` | `globalThis.WebSocket` | Inject for Node or tests |
| `RTCPeerConnection` | `RTCCtor` | `globalThis.RTCPeerConnection` | Without one, phones fall back to relay |
| `clock` | `Clock` | `defaultClock` | Timers and `now()` |
| `random` | `() => number` | `Math.random` | Backoff jitter source |
| `storage` | `StorageLike` | `sessionStorage` | Holds the TV token for `resume()` |
| `iceServers` | `{ urls: string \| string[] }[]` | `DEFAULT_ICE` | STUN/TURN servers |
| `transport` | `TransportPolicy` | `'auto'` | `'relay-only'` skips WebRTC |
| `pingIntervalMs` | `number` | `2000` | Ping period |
| `openTimeoutMs` | `number` | `4000` | DataChannel open timeout per phone |

```ts
const host = new CouchHost({ wsUrl: 'wss://example.com/ws', household: 'living-room' });
```

### host.create()

```ts
create(): Promise<{ code: string }>
```

Connects and sends `room.create`. Players from a previous room are forgotten first.

**Returns** the new room code. The code and TV token are saved to `storage`.

**Rejects** with `host.superseded` if `create()` or `resume()` is called again before it settles, `host.closed` if `close()` is called first, or a server error code.

```ts
const { code } = await host.create(); // 'KMPV'
```

**See also** [resume()](#host-resume-code), [Error codes](./errors#host-tv).

### host.resume(code?)

```ts
resume(code?: string): Promise<{ code: string }>
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `code` | `string` | last room (`LAST_ROOM_KEY`) | Room to reclaim; upper-cased |

Reclaims a room after a reload, using the stored TV token. Players are forgotten if the code differs from the current one. On success the host emits `resumed`, and the server's live player list replaces its own.

**Returns** the room code.

**Rejects** with `room.badToken` when no token is stored, the server's code (`room.notFound`, `room.badToken`) when it refuses, `host.superseded` or `host.closed`. A refused resume forgets the token and stops the socket, so falling back to `create()` is safe.

```ts
const { code } = await host.resume().catch(() => host.create());
```

**See also** [TV resume](./concepts#tv-resume).

### host.on(event, cb)

```ts
on(ev: 'player' | 'left' | 'input' | 'msg' | 'resumed' | 'error', cb: Listener): void
```

| Event | Callback | When |
|---|---|---|
| `player` | `(id: string, info: { name: string; avatar: string })` | A phone joins or rejoins, or reappears after a resume |
| `left` | `(id: string)` | A phone's socket closes, or it is missing after a resume |
| `input` | `(id: string, frame: InputFrame)` | A validated input frame. Continuous frames that are not newer are dropped first |
| `msg` | `(id: string, msg: PeerMsg)` | Any other peer message, such as a `screen` sent by the phone |
| `resumed` | `(code: string)` | `room.resumed` arrived |
| `error` | `(code: BackendErrorCode)` | A server error outside a pending create or resume |

```ts
host.on('input', (id: string, f: InputFrame) => {
  if (f.vote !== undefined) tally(id, f.vote);
});
```

### host.sendTo(playerId, msg)

```ts
sendTo(playerId: string, msg: PeerMsg): boolean
```

| Parameter | Type | Description |
|---|---|---|
| `playerId` | `string` | Target player |
| `msg` | `PeerMsg` | Usually `{ t: 'screen', name, data }` |

Reliable send: the `state` DataChannel when direct, else the relay (chunked above 28 KB), else the queue (max 64) while the socket is down.

**Returns** `false` when the player is unknown or has left, the queue is full, or the message needs more than 64 relay chunks.

```ts
host.sendTo(id, { t: 'screen', name: 'vote', data: { widgets: [{ kind: 'vote', id: 'v', options: ['Red', 'Blue'] }] } });
```

**See also** [Reliable queue](./concepts#reliable-queue), [tooLargeForRelay()](#toolargeforrelay-msg).

### host.broadcast(msg)

```ts
broadcast(msg: PeerMsg): void
```

`sendTo()` for every connected player.

```ts
host.broadcast({ t: 'screen', name: 'lobby' });
```

### host.players()

```ts
players(): Map<string, PlayerView>
```

**Returns** a snapshot of every player the host has seen in this room.

```ts
interface PlayerView { name: string; avatar: string; connected: boolean; transport: Mode; rttMs: number }
```

```ts
for (const [id, p] of host.players()) console.log(id, p.name, p.transport, `${p.rttMs} ms`);
```

### host.close()

```ts
close(): void
```

Closes the socket and every peer, stops pings, clears the queue and chunk buffers. A pending `create()` or `resume()` rejects with `host.closed`.

### TV_TOKEN_KEY, LAST_ROOM_KEY

```ts
const TV_TOKEN_KEY: (code: string) => string; // 'couchpad.tv.<CODE>'
const LAST_ROOM_KEY = 'couchpad.tv.last';
```

The storage keys the host uses.

```ts
sessionStorage.removeItem(TV_TOKEN_KEY('KMPV')); // forget a saved room
```

## CouchClient

The phone side. Joins a room, offers WebRTC to the TV and relays through the socket when direct is down. Implements [`Transport`](#transport).

```ts
class CouchClient implements Transport {
  playerId?: string;
  constructor(opts: CouchClientOpts);
}
```

### new CouchClient(opts)

| Option | Type | Default | Description |
|---|---|---|---|
| `wsUrl` | `string` | required | Signaling server WebSocket URL |
| `WebSocket` | `WebSocketCtor` | `globalThis.WebSocket` | Inject for Node or tests |
| `RTCPeerConnection` | `RTCCtor` | `globalThis.RTCPeerConnection` | Without one, the client stays on relay |
| `clock` | `Clock` | `defaultClock` | Timers and `now()` |
| `random` | `() => number` | `Math.random` | Backoff jitter source |
| `storage` | `StorageLike` | `sessionStorage` | Rejoin tokens, keyed by room code |
| `iceServers` | `{ urls: string \| string[] }[]` | `DEFAULT_ICE` | STUN/TURN servers |
| `transport` | `TransportPolicy` | `'auto'` | `'relay-only'` skips WebRTC |
| `inputHz` | `number` | `30` | Continuous input rate |
| `pingIntervalMs` | `number` | `2000` | Ping period |
| `openTimeoutMs` | `number` | `4000` | DataChannel open timeout |
| `joinTimeoutMs` | `number` | `8000` | `join()` gives up after this |

```ts
const client = new CouchClient({ wsUrl: 'wss://example.com/ws' });
```

### client.join(code, name)

```ts
join(code: string, name: string): Promise<{ playerId: string }>
```

| Parameter | Type | Description |
|---|---|---|
| `code` | `string` | Room code; upper-cased |
| `name` | `string` | Display name sent to the host |

Joins (or switches to) a room. A stored rejoin token for that code is sent automatically.

**Returns** the `playerId`, which is also set on `client.playerId`.

**Rejects** with `join.timeout`, `join.superseded` (a newer `join()`), `join.closed` (`close()` was called), or a server code such as `room.notFound` or `room.full`.

```ts
try {
  const { playerId } = await client.join('kmpv', 'Asha');
} catch (e) {
  if ((e as Error).message === 'room.full') showFullMessage();
}
```

**See also** [Rejoin tokens](./concepts#rejoin-tokens), [Error codes](./errors#client-phone).

### client.sendInput(frame)

```ts
sendInput(frame: InputFrame): void
```

| Parameter | Type | Description |
|---|---|---|
| `frame` | `InputFrame` | Usually produced by `mountController()` |

Splits the frame in two. One-shot fields (`swipe`, `vote`, `text`, `draw`) go reliably, and a `draw` longer than `MAX_DRAW_BYTES` is dropped. Continuous fields (`axes`, `buttons`, `tilt`) go on the lossy channel, throttled to `inputHz`, sent at once on a button edge, and resent every 100 ms while anything is held. Timestamps are kept strictly increasing.

```ts
client.sendInput({ t: performance.now(), axes: { x: 0.4, y: -1 }, buttons: { jump: true } });
client.sendInput({ t: performance.now(), vote: 2 });
```

**See also** [Keepalive](./concepts#keepalive).

### client.send(msg)

```ts
send(msg: PeerMsg): boolean
```

Reliable app message to the host, which receives it as a `msg` event.

**Returns** `false` when the queue is full (64) or the message needs more than 64 relay chunks.

```ts
client.send({ t: 'screen', name: 'ready' });
```

### client.onMessage(cb)

```ts
onMessage(cb: (m: PeerMsg) => void): void
```

Called for every peer message from the host except pings.

```ts
client.onMessage((m) => { if (m.t === 'screen') render(m.name, m.data); });
```

### client.on(event, cb)

```ts
on(ev: 'msg' | 'mode' | 'tv.left' | 'tv.back' | 'error' | 'link', cb: Listener): void
```

| Event | Callback | When |
|---|---|---|
| `mode` | `(mode: Mode)` | The transport changed |
| `tv.left` | `()` | The host's socket closed |
| `tv.back` | `()` | The host resumed; the phone re-offers WebRTC |
| `link` | `(state: 'down' \| 'up')` | The phone's own socket dropped after joining, and rejoined |
| `error` | `(code: BackendErrorCode)` | A server error after joining |
| `msg` | `(msg: PeerMsg)` | Same as `onMessage` |

```ts
client.on('link', (s: 'down' | 'up') => { banner.hidden = s === 'up'; });
```

### client.mode, client.rttMs()

```ts
readonly mode: Mode;   // 'direct' | 'relay'
rttMs(): number;       // last measured round trip, 0 before the first pong
```

### client.close()

```ts
close(): void
```

Rejects a pending join with `join.closed`, closes the socket and peer, and clears timers and the queue.

### Transport

```ts
interface Transport {
  sendInput(frame: InputFrame): void;
  send(msg: PeerMsg): boolean;
  onMessage(cb: (m: PeerMsg) => void): void;
  readonly mode: Mode;
  rttMs(): number;
}
type TransportPolicy = 'auto' | 'relay-only';
```

Code your game against `Transport` and you can swap in a fake in tests.

### Client constants

| Constant | Value | Meaning |
|---|---|---|
| `INPUT_HZ` | `30` | Continuous input rate |
| `PING_INTERVAL_MS` | `2000` | Ping period on both sides |
| `JOIN_TIMEOUT_MS` | `8000` | `join()` gives up after this |
| `KEEPALIVE_MS` | `100` | Held input resend period |
| `RELEASE_REPEAT_MS` | `30` | Delay before the duplicate release |
| `RELIABLE_QUEUE_MAX` | `64` | Reliable queue bound |

## Peer

One WebRTC link with two DataChannels and the relay-fallback rules. `CouchHost` and `CouchClient` create these; use it directly only for a custom transport.

### new Peer(opts)

```ts
new Peer(opts: PeerOpts)
```

| Option | Type | Default | Description |
|---|---|---|---|
| `role` | `'offerer' \| 'answerer'` | required | The phone offers, the TV answers |
| `RTC` | `RTCCtor` | required | `RTCPeerConnection` or a fake |
| `clock` | `Clock` | required | Timers |
| `iceServers` | `{ urls: string \| string[] }[]` | `DEFAULT_ICE` | STUN/TURN servers |
| `openTimeoutMs` | `number` | `4000` | Fall back if both channels are not open by then |
| `signal` | `(d: SignalData) => void` | required | Send an offer, answer or candidate to the other side |
| `onMessage` | `(raw: string) => void` | required | A string arrived on either channel |
| `onMode` | `(m: Mode) => void` | required | `'direct'` once open, `'relay'` after a failure |

```ts
const peer = new Peer({
  role: 'offerer', RTC: RTCPeerConnection as unknown as RTCCtor, clock: defaultClock,
  signal: (d) => ws.send(JSON.stringify({ t: 'signal', to: 'tv', data: d })),
  onMessage: (raw) => console.log(parsePeerMsg(raw)),
  onMode: (m) => console.log('now', m),
});
await peer.start();
```

### Peer members

| Member | Signature | Description |
|---|---|---|
| `mode` | `Mode` | Starts `'relay'` |
| `dead` | `boolean` | True after `fail()` or `close()` |
| `start()` | `() => Promise<void>` | Offerer only: create the `input` and `state` channels and send the offer |
| `handleSignal(d)` | `(d: SignalData) => Promise<void>` | Apply a remote offer, answer or candidate. Bad signals are ignored |
| `sendLossy(data)` | `(data: string) => boolean` | Send on `input`. `false` means relay it yourself |
| `sendReliable(data)` | `(data: string) => boolean` | Send on `state`. `false` means relay it yourself |
| `fail()` | `() => void` | Give up on direct for good |
| `close()` | `() => void` | Close the connection |

### Peer types and constants

```ts
type Mode = 'direct' | 'relay';
type SignalData =
  | { kind: 'offer' | 'answer'; sdp: string }
  | { kind: 'candidate'; candidate: unknown };
type RTCCtor = new (config: { iceServers: { urls: string | string[] }[] }) => RTCLike;
```

`RTCLike` and `ChannelLike` are the minimal structural types of `RTCPeerConnection` and `RTCDataChannel` that couchpad uses.

| Constant | Value |
|---|---|
| `STUN_URL` | `'stun:stun.l.google.com:19302'` |
| `DEFAULT_ICE` | `[{ urls: STUN_URL }]` |
| `OPEN_TIMEOUT_MS` | `4000` |
| `DISCONNECTED_GRACE_MS` | `2000` |

## Signaling

The WebSocket link with auto-reconnect and backoff.

### new Signaling(opts)

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | required | WebSocket URL |
| `WebSocket` | `WebSocketCtor` | `globalThis.WebSocket` | Inject for Node or tests |
| `clock` | `Clock` | required | Timers |
| `random` | `() => number` | `Math.random` | Jitter source |
| `onOpen` | `(reconnect: boolean) => void` | required | Every (re)open; join or resume here |
| `onMessage` | `(m: BackendToClient) => void` | required | Every parsed message with a string `t`. Errors thrown here are swallowed |
| `onDown` | `() => void` | none | The socket closed |

```ts
const sig = new Signaling({
  url: 'wss://example.com/ws', clock: defaultClock,
  onOpen: () => sig.send({ t: 'room.create' }),
  onMessage: (m) => console.log(m.t),
});
sig.connect();
```

### Signaling members

| Member | Signature | Description |
|---|---|---|
| `isOpen` | `boolean` (getter) | The socket is open |
| `connect()` | `() => void` | Open a socket. Closes any previous socket and cancels a pending retry |
| `send(m)` | `(m: ClientToBackend) => boolean` | Send if open; `false` (and dropped) while down |
| `close()` | `() => void` | Close and stop reconnecting |

### Injectable environment

```ts
interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(h: unknown): void;
}
const defaultClock: Clock; // looks up globals lazily, so fake timers installed later still apply

interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
function defaultStorage(): StorageLike; // sessionStorage, or an in-memory map when it is blocked

type WebSocketCtor = new (url: string) => WebSocketLike;
```

```ts
import WebSocket from 'ws';
const client = new CouchClient({
  wsUrl: 'ws://localhost:8787/ws',
  WebSocket: WebSocket as unknown as WebSocketCtor,
  transport: 'relay-only',
});
```

| Constant | Value | Meaning |
|---|---|---|
| `BACKOFF_MS` | `[250, 500, 1000, 2000, 4000, 8000]` | Reconnect delays |
| `BACKOFF_JITTER` | `0.3` | ±30% |
| `STABLE_OPEN_MS` | `3000` | Backoff resets only after a socket stays open this long |

## Relay utilities

### relayPayloads(msg)

```ts
function relayPayloads(msg: unknown): unknown[]
```

**Returns** `[msg]` when its UTF-8 JSON is at most `RELAY_CHUNK_BYTES`, else a list of `RelayChunk` envelopes, each under 28 KB serialized.

```ts
for (const data of relayPayloads(bigMsg)) ws.send(JSON.stringify({ t: 'relay', to: 'tv', data }));
```

### tooLargeForRelay(msg)

```ts
function tooLargeForRelay(msg: unknown): boolean
```

**Returns** `true` when `msg` needs more than `MAX_CHUNKS` (64) relay chunks. Receivers reject such messages, so `send()` and `sendTo()` return `false` for them instead of queueing.

```ts
if (tooLargeForRelay(level)) splitLevel(level);
```

### Reassembler

```ts
class Reassembler {
  constructor(clock: { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(h: unknown): void });
  accept(from: string, data: unknown): unknown;
  drop(from: string): void;
  clear(): void;
}
interface RelayChunk { t: '~chunk'; id: number; seq: number; total: number; part: string }
```

| Member | Description |
|---|---|
| `accept(from, data)` | Returns the complete payload, passes unchunked data through, or `undefined` while incomplete. Rejects malformed chunks, duplicates and parts over 28 KB |
| `drop(from)` | Forget a sender's partials (it reconnected and its chunk ids restart) |
| `clear()` | Forget everything |

Partials expire after 10 s, and at most `MAX_OPEN_PER_SENDER` (4) are kept per sender; the oldest is dropped beyond that.

```ts
const r = new Reassembler(defaultClock);
const whole = r.accept(m.from, m.data);
if (whole !== undefined) handle(whole);
```

### parsePeerMsg(raw)

```ts
function parsePeerMsg(raw: unknown): PeerMsg | undefined
```

Accepts a JSON string (DataChannel) or an object (relay). **Returns** a validated `PeerMsg`, or `undefined`.

```ts
channel.onmessage = (ev) => { const m = parsePeerMsg(ev.data); if (m?.t === 'input') use(m.frame); };
```

### BoundedQueue

```ts
class BoundedQueue<T> {
  constructor(max?: number);   // default 64
  readonly max: number;
  readonly size: number;
  push(x: T): boolean;         // false when full
  drain(): T[];
}
```

```ts
const q = new BoundedQueue<PeerMsg>(16);
if (!q.push(msg)) console.warn('queue full');
```

### Emitter

```ts
type Listener = (...args: any[]) => void;
class Emitter {
  on(ev: string, cb: Listener): void;
  off(ev: string, cb: Listener): void;
  emit(ev: string, ...args: unknown[]): void; // a throwing listener does not stop the others
}
```

### Size constants

| Constant | Value | Meaning |
|---|---|---|
| `RELAY_CHUNK_BYTES` | `28 * 1024` | Largest serialized relay payload |
| `MAX_CHUNKS` | `64` | Most chunks per message |
| `MAX_OPEN_PER_SENDER` | `4` | Partial messages kept per sender |
| `REASSEMBLY_TIMEOUT_MS` | `10_000` | Partials expire after this |
| `MAX_DRAW_BYTES` | `200 * 1024` | Larger drawings are dropped before send |

## Types and schemas

### InputFrame

```ts
interface InputFrame {
  t: number;                                // sender-local timestamp, ms
  axes?: { x: number; y: number };          // joystick, -1..1
  buttons?: Record<string, boolean>;        // by widget id
  tilt?: { x: number; y: number };          // -1..1
  swipe?: 'up' | 'down' | 'left' | 'right';
  draw?: string;                            // PNG/JPEG data URL
  vote?: number;                            // option index
  text?: string;
}
const InputFrameSchema: z.ZodType<InputFrame>;
```

### ControlWidget

```ts
type ControlWidget =
  | { kind: 'joystick'; id: string }
  | { kind: 'button'; id: string; label: string }
  | { kind: 'hold'; id: string; label: string }
  | { kind: 'tilt'; id: string }
  | { kind: 'swipe'; id: string }
  | { kind: 'draw'; id: string; prompt: string }
  | { kind: 'vote'; id: string; options: string[] }
  | { kind: 'text'; id: string; placeholder: string };
const ControlWidgetSchema: z.ZodType<ControlWidget>;
```

The schema allows ids of 1 to 32 characters, labels up to 20, prompts up to 80, 2 to 6 vote options of up to 40 characters, and placeholders up to 60. Validate widget lists from untrusted sources before sending them:

```ts
const widgets = z.array(ControlWidgetSchema).parse(untrusted);
```

### PeerMsg

```ts
type PeerMsg =
  | { t: 'input'; frame: InputFrame }
  | { t: 'screen'; name: string; data?: unknown }  // name: 1 to 32 chars
  | { t: 'ping'; id: number }
  | { t: 'pong'; id: number };
const PeerMsgSchema; // zod discriminated union on `t`
```

### ROOM_CODE_RE

```ts
const ROOM_CODE_RE = /^[BCDFGHJKLMNPQRSTVWXZA]{4}$/;
ROOM_CODE_RE.test('KMPV'); // true
```

### Wire types

```ts
interface PlayerInfo { id: string; name: string; avatar?: string }
type BackendErrorCode = 'room.notFound' | 'room.full' | 'room.badRequest' | 'room.notInRoom'
  | 'room.targetGone' | 'room.badToken' | 'room.rateLimited' | (string & {});
```

`ClientToBackend` and `BackendToClient` are listed message by message in [Protocol messages](./protocol).
