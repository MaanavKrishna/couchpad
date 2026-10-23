# Running the example server

The repo ships a runnable example: a reference signaling server, a host page and a phone page.

```bash
git clone https://github.com/MaanavKrishna/couchpad
cd couchpad
npm install
npm run example
```

`npm run example` bundles `examples/host/host.ts` and `examples/phone/phone.ts` with esbuild into `examples/dist`, then starts `examples/server/server.mjs` on **http://localhost:8787**.

1. Open `http://localhost:8787` on the computer. It shows a room code.
2. On a phone on the same Wi-Fi, open `http://<your-computer-ip>:8787/phone.html?room=CODE`.
3. Move the stick. The status line on the phone shows `connected (direct)` or `connected (relay)`.

Set `PORT` to change the port:

```bash
PORT=9000 npm run example
```

::: tip Tilt and vibration need HTTPS
A LAN IP is not a secure context, so tilt falls back to a joystick. Put the server behind an HTTPS tunnel, or use a local certificate, to test tilt.
:::

## What the server does

`server.mjs` is about 100 lines on top of `ws`, and covers the whole [protocol](./protocol):

- Rooms in memory, with 4-letter codes from the same alphabet as `ROOM_CODE_RE`, and a limit of 8 players.
- Random 12-byte hex tokens for the TV and for each player.
- `room.join` with a matching `rejoinToken` reuses the player's seat and `playerId`.
- Phones may only address `'tv'`. The server stamps `from` itself.
- When the TV socket closes, every phone gets `tv.left`. On `room.resume` with the right token, every phone gets `tv.back`.
- WebSocket frames are capped at 128 KB (`maxPayload`).

## Going to production

The example keeps rooms in memory on one process. Cadabra runs the same protocol on API Gateway WebSocket, Lambda and DynamoDB. That is why relay payloads are chunked at 28 KB: API Gateway frames cap near 32 KB. Things to add for production:

- Persist rooms and tokens (DynamoDB, Redis) so a deploy does not end every game.
- Rate-limit joins and relays per connection and return `room.rateLimited`.
- Expire idle rooms.
- Run your own TURN server, or accept the relay as the fallback (see the [FAQ](./faq)).
