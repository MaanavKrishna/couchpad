# Concepts

## Signaling

Every phone and the host keep one WebSocket open to your signaling server. It does three jobs:

- **Rooms.** The host sends `room.create`, phones send `room.join` with the 4-letter code.
- **WebRTC signaling.** Offers, answers and ICE candidates travel as `{t:'signal', to, data}`. Phones always address `'tv'`; the host addresses a `playerId`. The server stamps `from` on the way out and must never trust a sender's own claim.
- **Relay.** When there is no direct path, `{t:'relay', to, data}` carries peer messages instead.

The socket reconnects on its own with jittered exponential backoff: **250, 500, 1000, 2000, 4000, 8000 ms**, each ±30% (`BACKOFF_MS`, `BACKOFF_JITTER`). The backoff only resets once a socket has stayed open for **3 s** (`STABLE_OPEN_MS`), so a link that flaps keeps backing off instead of hammering the server. On every reopen the client re-sends `room.join` (with its rejoin token) and the host re-sends `room.resume`.

## DataChannels: unordered input, reliable state

The phone is the WebRTC offerer and opens two channels:

| Channel | Options | Carries |
|---|---|---|
| `input` | `{ ordered: false, maxRetransmits: 0 }` | Continuous input: joystick `axes`, `tilt`, held `buttons` |
| `state` | `{ ordered: true }` | Everything that must arrive: one-shots (`swipe`, `vote`, `text`, `draw`), `screen` updates, pings |

A late stick sample is worse than a lost one, so continuous input never retransmits. The host keeps the newest `t` per player and drops any continuous frame that is not newer. One-shot fields are split out of the frame and always sent reliably.

Continuous input is throttled to **30 Hz** (`INPUT_HZ`), except that a button edge is sent immediately.

A `Peer` starts in `relay` mode and becomes `direct` only when **both** channels are open.

## Relay fallback

couchpad falls back to the relay, for good for that peer, when any of these happens:

- the channels are not open within **4 s** (`OPEN_TIMEOUT_MS`),
- the connection state becomes `failed` or `closed`,
- the state is `disconnected` for longer than **2 s** (`DISCONNECTED_GRACE_MS`),
- a channel closes while direct.

Callers never block on any of this. While the link is opening, sends go through the relay. Your game code calls `sendInput()` and `sendTo()` the same way in either mode. You can read the current path from `client.mode` or `host.players().get(id).transport`, and force the relay with `transport: 'relay-only'`.

## Chunking at 28 KB

API Gateway WebSocket frames cap near 32 KB, and drawings or large `screen` payloads can exceed that. `relayPayloads()` returns the message as is when its UTF-8 JSON is at most **28 KB** (`RELAY_CHUNK_BYTES`), and otherwise splits it into envelopes:

```ts
{ t: '~chunk', id: 7, seq: 0, total: 3, part: '{"t":"input","frame":{"t":91…' }
```

Each serialized envelope stays under 28 KB with 128 bytes of headroom for the relay wrapper. The receiver's `Reassembler` joins parts per sender and chunk id, ignores duplicates and malformed envelopes, caps `total` at 64, and throws away partial sets after **10 s** (`REASSEMBLY_TIMEOUT_MS`). Your server forwards `relay.data` untouched.

## Keepalive

Two separate things keep a session healthy:

- **Held input keepalive.** While any button is held or a stick or tilt is deflected, the latest continuous frame is resent every **100 ms** (`KEEPALIVE_MS`) with an advancing timestamp. A lost packet on the unordered channel can never leave a button stuck pressed or released. A release is sent twice, **30 ms** apart (`RELEASE_REPEAT_MS`). On window blur, a hidden tab or unmount, the widgets send one zeroed frame.
- **Ping.** Both sides send `{t:'ping', id}` every **2 s** (`PING_INTERVAL_MS`) and answer with `pong`. The round trip is exposed as `client.rttMs()` and `players().get(id).rttMs`. Pings are never queued.

## Reliable queue

`send()` and `sendTo()` try the `state` channel, then the relay. If neither path is up (the WebSocket is reconnecting), the message goes into a `BoundedQueue` of at most **64** messages (`RELIABLE_QUEUE_MAX`). The queue flushes in order when the socket rejoins or the direct link opens. Once a queue is non-empty, new messages line up behind it so order is kept. When the queue is full, `send()` returns `false`.

## Rejoin tokens

`room.joined` carries a `token`. The client stores it keyed by room code in `sessionStorage` (or the `storage` you pass). After a refresh or socket drop, `room.join` includes `rejoinToken`, and the server gives back the same `playerId`. The host sees `player.joined` for an id it already knows, closes the old peer and waits for a fresh offer, so the player keeps their seat, score and colour.

If the server rejects the token (any error other than `room.full`), the client forgets it.

## TV resume

The host stores its `tvToken` under `couchpad.tv.<CODE>` and the last code under `couchpad.tv.last`. When the TV app restarts:

1. Phones receive `tv.left`. Their peers close, they drop to relay mode, and reliable sends wait in the queue.
2. The new host calls `resume()`, which sends `{t:'room.resume', code, tvToken}`.
3. The server answers `room.resumed` with the live player list. The host treats it as the truth: missing players emit `left`, new or revived ones emit `player`.
4. Phones receive `tv.back` and re-offer WebRTC. The link goes direct again if the network allows it.

The same path runs when only the host's socket drops: on reopen, the host resumes instead of creating.
