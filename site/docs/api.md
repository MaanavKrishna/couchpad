# API reference

Everything below is exported from the package root:

```ts
import { CouchHost, CouchClient, mountController /* , ... */ } from 'couchpad';
```

Widgets have their own page: [Widgets](./widgets). Wire messages are listed in [Protocol messages](./protocol).

## CouchHost

The TV side. Owns the room, answers each phone's WebRTC offer and relays when direct is down.

```ts
class CouchHost {
  code?: string;
  constructor(opts: CouchHostOpts);
  create(): Promise<{ code: string }>;
  resume(code?: string): Promise<{ code: string }>;
  on(ev: 'player' | 'left' | 'input' | 'msg' | 'resumed' | 'error', cb: Listener): void;
  sendTo(playerId: string, msg: PeerMsg): boolean;
  broadcast(msg: PeerMsg): void;
  players(): Map<string, PlayerView>;
  close(): void;
}
```

### CouchHostOpts

```ts
interface CouchHostOpts {
  wsUrl: string;
  household: string;                          // sent with room.create
  WebSocket?: WebSocketCtor;                  // default: globalThis.WebSocket
  RTCPeerConnection?: RTCCtor;                // default: globalThis.RTCPeerConnection
  clock?: Clock;                              // default: defaultClock
  random?: () => number;                      // backoff jitter source
  storage?: StorageLike;                      // holds the TV token; default sessionStorage
  iceServers?: { urls: string | string[] }[]; // default: DEFAULT_ICE (Google STUN)
  transport?: TransportPolicy;                // 'auto' | 'relay-only'
  pingIntervalMs?: number;                    // default 2000
  openTimeoutMs?: number;                     // default 4000
}
```

### create()

Connects and sends `room.create`. Resolves with the new room code.

```ts
const { code } = await host.create(); // e.g. 'KMPV'
```

### resume(code?)

Reclaims a room after a reload using the TV token in storage. Without `code` it uses the last room (`LAST_ROOM_KEY`). Rejects with `room.badToken` when no token is stored, or with the server's error code if the room is gone. On rejection the stored token is forgotten, so falling back to `create()` is safe.

```ts
const { code } = await host.resume().catch(() => host.create());
```

### on(event, cb)

| Event | Callback | When |
|---|---|---|
| `player` | `(id: string, info: { name: string; avatar: string })` | A phone joins or rejoins, or reappears after a resume |
| `left` | `(id: string)` | A phone's socket closes, or it is missing after a resume |
| `input` | `(id: string, frame: InputFrame)` | A validated input frame. Stale continuous frames are dropped first |
| `msg` | `(id: string, msg: PeerMsg)` | Any other peer message, for example a `screen` sent by the phone |
| `resumed` | `(code: string)` | `room.resumed` arrived |
| `error` | `(code: BackendErrorCode)` | A server error outside a pending create or resume |

```ts
host.on('input', (id: string, f: InputFrame) => {
  if (f.vote !== undefined) tally(id, f.vote);
});
```

### sendTo(playerId, msg)

Reliable send to one player: the `state` channel when direct, else the relay (chunked above 28 KB), else the queue (max 64) while the socket is down. Returns `false` for unknown or departed players and when the queue is full.

```ts
host.sendTo(id, { t: 'screen', name: 'vote', data: { widgets: [{ kind: 'vote', id: 'v', options: ['Red', 'Blue'] }] } });
```

### broadcast(msg)

`sendTo` for every connected player.

```ts
host.broadcast({ t: 'screen', name: 'lobby' });
```

### players()

A snapshot of every player the host has seen.

```ts
for (const [id, p] of host.players()) console.log(id, p.name, p.transport, `${p.rttMs} ms`);
```

### close()

Closes the socket and every peer, stops pings and clears the queue.

### PlayerView

```ts
interface PlayerView {
  name: string;
  avatar: string;
  connected: boolean;
  transport: Mode;   // 'direct' | 'relay'
  rttMs: number;
}
```

### TV_TOKEN_KEY, LAST_ROOM_KEY

```ts
const TV_TOKEN_KEY: (code: string) => string; // 'couchpad.tv.<CODE>'
const LAST_ROOM_KEY = 'couchpad.tv.last';
```

Storage keys the host uses. Useful if you want to clear a saved room:

```ts
sessionStorage.removeItem(TV_TOKEN_KEY('KMPV'));
```

## CouchClient

The phone side. Joins a room, offers WebRTC to the TV and relays through the socket when direct is down. Implements `Transport`.

```ts
class CouchClient implements Transport {
  playerId?: string;
  constructor(opts: CouchClientOpts);
  readonly mode: Mode;
  rttMs(): number;
  join(code: string, name: string): Promise<{ playerId: string }>;
  sendInput(frame: InputFrame): void;
  send(msg: PeerMsg): boolean;
  onMessage(cb: (m: PeerMsg) => void): void;
  on(ev: 'msg' | 'mode' | 'tv.left' | 'tv.back' | 'error' | 'link', cb: Listener): void;
  close(): void;
}
```

### CouchClientOpts

```ts
interface CouchClientOpts {
  wsUrl: string;
  WebSocket?: WebSocketCtor;
  RTCPeerConnection?: RTCCtor;
  clock?: Clock;
  random?: () => number;
  storage?: StorageLike;                      // rejoin tokens keyed by room code; default sessionStorage
  iceServers?: { urls: string | string[] }[];
  transport?: TransportPolicy;                // 'relay-only' skips WebRTC entirely
  inputHz?: number;                           // default 30
  pingIntervalMs?: number;                    // default 2000
  openTimeoutMs?: number;                     // default 4000
  joinTimeoutMs?: number;                     // default 8000
}
```

### join(code, name)

Joins (or switches to) a room. The code is upper-cased. A stored rejoin token for that code is sent automatically. A second call supersedes a pending one, which rejects with `join.superseded`. Other rejections: `join.timeout`, `join.closed`, or a server code such as `room.notFound` and `room.full`.

```ts
try {
  const { playerId } = await client.join('kmpv', 'Asha');
} catch (e) {
  if ((e as Error).message === 'room.full') showFullMessage();
}
```

### sendInput(frame)

Splits a frame in two. One-shot fields (`swipe`, `vote`, `text`, `draw`) go reliably; a `draw` longer than `MAX_DRAW_BYTES` is dropped. Continuous fields (`axes`, `buttons`, `tilt`) go on the lossy channel, throttled to `inputHz`, immediately on a button edge, with a 100 ms keepalive while anything is held. Timestamps are kept strictly increasing.

```ts
client.sendInput({ t: performance.now(), axes: { x: 0.4, y: -1 }, buttons: { jump: true } });
client.sendInput({ t: performance.now(), vote: 2 });
```

### send(msg) and onMessage(cb)

Reliable app messages in either direction. `send` returns `false` only when the queue is full.

```ts
client.onMessage((m) => { if (m.t === 'screen') render(m.name, m.data); });
client.send({ t: 'screen', name: 'ready' }); // arrives at the host as a 'msg' event
```

### mode and rttMs()

`mode` is `'direct'` or `'relay'`. `rttMs()` is the last measured round trip in ms (0 until the first pong).

### on(event, cb)

| Event | Callback | When |
|---|---|---|
| `mode` | `(mode: Mode)` | The transport changed |
| `tv.left` | `()` | The host's socket closed |
| `tv.back` | `()` | The host resumed; the phone re-offers WebRTC |
| `link` | `(state: 'down' \| 'up')` | The phone's own socket dropped after joining, and rejoined |
| `error` | `(code: BackendErrorCode)` | A server error after joining |
| `msg` | `(msg: PeerMsg)` | Same as `onMessage` |

```ts
client.on('link', (s: 'down' | 'up') => banner.hidden = s === 'up');
```

### close()

Rejects any pending join with `join.closed`, closes the socket and the peer, and clears timers and the queue.

### Transport

The interface both your game code and test doubles can target.

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

One WebRTC link with two DataChannels and the relay-fallback rules. `CouchHost` and `CouchClient` create these for you; use it directly only for a custom transport.

```ts
type Mode = 'direct' | 'relay';

class Peer {
  mode: Mode;   // starts 'relay'
  dead: boolean;
  constructor(opts: PeerOpts);
  start(): Promise<void>;                       // offerer: create channels, send offer
  handleSignal(d: SignalData): Promise<void>;
  sendLossy(data: string): boolean;             // 'input' channel; false = relay it yourself
  sendReliable(data: string): boolean;          // 'state' channel; false = relay it yourself
  fail(): void;                                 // give up on direct for good
  close(): void;
}

interface PeerOpts {
  role: 'offerer' | 'answerer';
  RTC: RTCCtor;
  clock: Clock;
  iceServers?: { urls: string | string[] }[];
  openTimeoutMs?: number;
  signal: (d: SignalData) => void;
  onMessage: (raw: string) => void;
  onMode: (m: Mode) => void;
}

type SignalData =
  | { kind: 'offer' | 'answer'; sdp: string }
  | { kind: 'candidate'; candidate: unknown };
```

```ts
const peer = new Peer({
  role: 'offerer', RTC: RTCPeerConnection as unknown as RTCCtor, clock: defaultClock,
  signal: (d) => ws.send(JSON.stringify({ t: 'signal', to: 'tv', data: d })),
  onMessage: (raw) => console.log(parsePeerMsg(raw)),
  onMode: (m) => console.log('now', m),
});
await peer.start();
```

`ChannelLike`, `RTCLike` and `RTCCtor` are the minimal structural types for `RTCDataChannel` and `RTCPeerConnection`, so you can pass fakes in tests.

| Constant | Value |
|---|---|
| `STUN_URL` | `'stun:stun.l.google.com:19302'` |
| `DEFAULT_ICE` | `[{ urls: STUN_URL }]` |
| `OPEN_TIMEOUT_MS` | `4000` |
| `DISCONNECTED_GRACE_MS` | `2000` |

## Signaling

The WebSocket link with auto-reconnect and backoff.

```ts
class Signaling {
  constructor(opts: SignalingOpts);
  readonly isOpen: boolean;
  connect(): void;
  send(m: ClientToBackend): boolean; // false (and dropped) while down
  close(): void;                     // stops reconnecting
}

interface SignalingOpts {
  url: string;
  WebSocket?: WebSocketCtor;
  clock: Clock;
  random?: () => number;
  onOpen: (reconnect: boolean) => void;   // join or resume here
  onMessage: (m: BackendToClient) => void;
  onDown?: () => void;
}
```

```ts
const sig = new Signaling({
  url: 'wss://your-server/ws', clock: defaultClock,
  onOpen: () => sig.send({ t: 'room.create' }),
  onMessage: (m) => console.log(m.t),
});
sig.connect();
```

### Injectable environment

```ts
interface WebSocketLike { readyState: number; onopen; onclose; onerror; onmessage; send(data: string): void; close(): void }
type WebSocketCtor = new (url: string) => WebSocketLike;

interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(h: unknown): void;
}
const defaultClock: Clock; // looks up globals lazily, so fake timers installed later still apply

interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
function defaultStorage(): StorageLike; // sessionStorage, or an in-memory map when blocked
```

```ts
import WebSocket from 'ws';
const client = new CouchClient({ wsUrl: 'ws://localhost:8787/ws', WebSocket: WebSocket as unknown as WebSocketCtor, transport: 'relay-only' });
```

| Constant | Value |
|---|---|
| `BACKOFF_MS` | `[250, 500, 1000, 2000, 4000, 8000]` |
| `BACKOFF_JITTER` | `0.3` |
| `STABLE_OPEN_MS` | `3000` |

## Utilities

### relayPayloads(msg)

```ts
function relayPayloads(msg: unknown): unknown[];
```

Returns `[msg]` when its JSON is at most `RELAY_CHUNK_BYTES`, else a list of `RelayChunk` envelopes.

```ts
for (const data of relayPayloads(bigMsg)) ws.send(JSON.stringify({ t: 'relay', to: 'tv', data }));
```

### Reassembler

```ts
class Reassembler {
  constructor(clock: { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(h: unknown): void });
  accept(from: string, data: unknown): unknown; // complete payload, pass-through, or undefined while incomplete
  clear(): void;
}
interface RelayChunk { t: '~chunk'; id: number; seq: number; total: number; part: string }
```

```ts
const r = new Reassembler(defaultClock);
const whole = r.accept(m.from, m.data);
if (whole !== undefined) handle(whole);
```

### parsePeerMsg(raw)

```ts
function parsePeerMsg(raw: unknown): PeerMsg | undefined;
```

Accepts a JSON string (DataChannel) or an object (relay) and returns a validated `PeerMsg`, or `undefined`.

```ts
channel.onmessage = (ev) => { const m = parsePeerMsg(ev.data); if (m?.t === 'input') use(m.frame); };
```

### BoundedQueue

```ts
class BoundedQueue<T> {
  constructor(max?: number); // default 64
  readonly max: number;
  readonly size: number;
  push(x: T): boolean;       // false when full
  drain(): T[];
}
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

| Constant | Value |
|---|---|
| `RELAY_CHUNK_BYTES` | `28 * 1024` |
| `REASSEMBLY_TIMEOUT_MS` | `10_000` |
| `MAX_DRAW_BYTES` | `200 * 1024` |

## Types and schemas

### InputFrame and InputFrameSchema

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

### ControlWidget and ControlWidgetSchema

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

The schema enforces ids of 1 to 32 characters, labels up to 20, prompts up to 80, 2 to 6 vote options of up to 40 characters, and placeholders up to 60. Validate widget lists from untrusted sources (for example, generated by an LLM) before sending them:

```ts
const widgets = z.array(ControlWidgetSchema).parse(untrusted);
```

### PeerMsg and PeerMsgSchema

```ts
type PeerMsg =
  | { t: 'input'; frame: InputFrame }
  | { t: 'screen'; name: string; data?: unknown }  // name: 1 to 32 chars, app-defined
  | { t: 'ping'; id: number }
  | { t: 'pong'; id: number };
```

### ROOM_CODE_RE

```ts
const ROOM_CODE_RE = /^[BCDFGHJKLMNPQRSTVWXZA]{4}$/;
ROOM_CODE_RE.test('KMPV'); // true
```

### Wire types

`PlayerInfo`, `BackendErrorCode`, `ClientToBackend` and `BackendToClient` describe the signaling protocol. See [Protocol messages](./protocol).

```ts
interface PlayerInfo { id: string; name: string; avatar?: string }
```
