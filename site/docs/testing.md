# Testing

couchpad's WebSocket, `RTCPeerConnection`, clock and storage are all injectable, so the whole transport state machine runs in Node with no browser.

```bash
npm install
npm test           # vitest run
npm run typecheck  # tsc --noEmit
```

## What the suite covers

There are 34 tests in three files.

**`test/host.test.ts`**: the transport, end to end with fakes.

- connects direct when the DataChannel opens, and falls back to relay after 4 s without one
- switches to relay on `failed`, and on `disconnected` for more than 2 s
- button edges skip the throttle; one-shot fields never use the lossy channel
- rejoin keeps the `playerId`; the client reconnects with backoff and rejoins
- the host resumes its room after its socket drops, and after a full page reload
- resume reconciles players, so missing ones leave
- a dropped button release still reaches the TV within 50 ms; a button held still for 2 s stays held
- stale continuous frames are dropped
- large relay messages are chunked under the 32 KB frame limit and reassembled; partials expire after 10 s
- the reliable queue flushes on rejoin and is bounded at 64
- backoff resets only after a stable 3 s open
- join times out after 8 s, and a second join supersedes the first

**`test/widgets.test.ts`** (jsdom): joystick axes and ARIA, hold edges, tilt fallback and recalibration, draw export size limits, text and vote, unmount and blur releasing held input, swipe ignoring `pointercancel`.

**`test/example-server.test.ts`**: a create, join, input and screen round trip over the relay against the real example server.

## Fakes you can reuse

`test/fakes.ts` has an in-memory backend that mirrors the protocol, plus:

| Fake | What it does |
|---|---|
| `FakeBackend` | Rooms, tokens and routing, with a `log` of every message and the largest frame seen (`maxFrame`) |
| `FakeWebSocket` | A `WebSocketLike` bound to the backend |
| `FakeRTC`, `FakeChannel` | A paired fake `RTCPeerConnection` with DataChannels |
| `BlockedRTC` | A `FakeRTC` that never connects, to force the relay |
| `MemStorage` | A `StorageLike` in memory |
| `WS_FRAME_MAX` | `32 * 1024`, the API Gateway frame cap |

## Testing your own game

Point couchpad at fakes and drive time with vitest's fake timers. `defaultClock` looks up timers lazily, so `vi.useFakeTimers()` works even after construction.

```ts
import { vi, test, expect } from 'vitest';
import { CouchHost, CouchClient } from 'couchpad';
import { FakeBackend, FakeWebSocket, BlockedRTC, MemStorage } from './fakes' // copied from couchpad/test/fakes.ts;

test('game survives hotel wifi', async () => {
  vi.useFakeTimers();
  // wire FakeWebSocket to a FakeBackend, pass RTCPeerConnection: BlockedRTC
  // ...create, join, then:
  await vi.advanceTimersByTimeAsync(4000);
  expect(client.mode).toBe('relay');
});
```

The fakes are in the repo, not in the package `files`, so copy `test/fakes.ts` into your project if you install from GitHub.
