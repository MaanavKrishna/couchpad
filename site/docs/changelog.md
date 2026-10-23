# Changelog

couchpad follows [semantic versioning](https://semver.org). Until 1.0, minor versions may change the API.

## Unreleased

- Documentation site at [maanavkrishna.github.io/couchpad](https://maanavkrishna.github.io/couchpad/).

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
- 34 tests running in Node with injectable fakes.
- CI for typecheck and tests.
