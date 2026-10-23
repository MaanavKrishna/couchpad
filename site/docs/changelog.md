# Changelog

couchpad follows [semantic versioning](https://semver.org). Until 1.0, minor versions may change the API.

## Unreleased

- Documentation site at [maanavkrishna.github.io/couchpad](https://maanavkrishna.github.io/couchpad/).

## 0.1.1

Five fixes found in a review of the transport, each with a regression test. The suite now has **39 tests** in four files.

- **Signaling:** a second `connect()` closes the previous socket and cancels a pending retry, so there is never an orphaned second link.
- **Malformed server messages** never throw into your app. `Signaling` swallows errors from `onMessage`, and the host ignores `player.joined` and `room.resumed` payloads without valid player ids.
- **Host lifecycle:** `create()` again starts with no players from the previous room, and so does `resume()` of a different code. `close()` rejects a pending `create()` or `resume()` with `host.closed`, a second call rejects the first with `host.superseded`, and a refused resume stops its timers.
- **Relay reassembly memory is bounded:** at most 4 partial messages per sender (`MAX_OPEN_PER_SENDER`) and parts of at most 28 KB. When a phone or the TV reconnects, its stale partials are dropped (`Reassembler.drop()`), because its chunk ids restart.
- **Oversized reliable messages:** `send()` and `sendTo()` return `false` for a message that needs more than 64 relay chunks (`MAX_CHUNKS`, `tooLargeForRelay()`), instead of queueing something the receiver would drop.

## 0.1.0 (2026-10-23)

First release, extracted from the Fire TV party game [Cadabra](https://github.com/MaanavKrishna/cadabra).

- `CouchHost` and `CouchClient` with QR room codes, WebRTC DataChannels and a WebSocket relay fallback after 4 s.
- Two channels: unordered, no-retransmit input at 30 Hz, and a reliable channel for one-shots and state.
- Relay chunking at 28 KB for 32 KB API Gateway frames, with 10 s reassembly expiry.
- Reconnect with jittered backoff (250 ms to 8 s), rejoin tokens for phones and room resume for the TV.
- Reliable queue of up to 64 messages while offline, 2 s ping with RTT, 100 ms held-input keepalive.
- `mountController` with 8 widget kinds: joystick, button, hold, tilt, swipe, draw, vote and text.
- Zod schemas for every wire message.
- Reference example server, host page and phone page.
- 39 tests running in Node with injectable fakes.
- CI for typecheck and tests.
