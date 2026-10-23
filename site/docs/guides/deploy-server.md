# Deploy the signaling server

couchpad needs a WebSocket server that speaks the [protocol](../protocol). It introduces phones to the TV, forwards WebRTC signals, and relays traffic when a direct link fails. It never needs to understand game data.

## What the server must do

| Responsibility | Messages |
|---|---|
| Create rooms with 4-letter codes from `BCDFGHJKLMNPQRSTVWXZA` | `room.create` → `room.created {code, tvToken}` |
| Let the TV reclaim a room with its token | `room.resume` → `room.resumed {players}`, then `tv.back` to phones |
| Seat phones, and give a seat back for a valid rejoin token | `room.join` → `room.joined {playerId, token}`, `player.joined` to the TV |
| Forward signals and relays, stamping `from` itself | `signal`, `relay` |
| Report presence | `player.left`, `tv.left` |
| Answer keepalives | `ping` → `pong` |

::: danger Never trust `from`
The server must set `from` on forwarded `signal` and `relay` messages from the connection it arrived on. Phones may only address `'tv'`.
:::

## Node and ws

The example server is a working Node implementation. Copy `examples/server/server.mjs` into your project and run it behind a TLS proxy.

```bash
npm install ws
PORT=8787 node server.mjs
```

<div class="out">couchpad example on http://localhost:8787  (phone: /phone.html)</div>

Point both sides at it with `wss://` once it is behind TLS:

```ts
new CouchHost({ wsUrl: 'wss://play.example.com/ws', household: 'living-room' });
new CouchClient({ wsUrl: 'wss://play.example.com/ws' });
```

### Behind nginx

```nginx
location /ws {
  proxy_pass http://127.0.0.1:8787;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 1h;
}
```

### Before you go live

The example keeps everything in memory in one process. For production:

- **Persist rooms and tokens** (Redis, a database) so a deploy or restart does not end every game.
- **Run one process per room**, or share room state between processes, because every socket in a room must reach the same state.
- **Rate-limit** joins and relays per connection, and answer `room.rateLimited`.
- **Expire idle rooms** and cap players per room (`room.full`).
- **Cap frame size.** The example uses `maxPayload: 128 * 1024`; couchpad never sends relay frames over about 28 KB of data.

## Cloudflare

Durable Objects suit this protocol well: one object per room code holds the TV socket, the player sockets and the tokens, so every message for a room reaches the same state. Use the WebSocket Hibernation API so idle rooms cost nothing. A Worker routes `room.create` to a new object and other messages to the object named by the room code.

## AWS

Cadabra runs this protocol on **API Gateway WebSocket, Lambda and DynamoDB**:

- `$connect` and `$disconnect` routes record and clear connections, and send `player.left` or `tv.left`.
- A `$default` route handles every message type and posts to other connections with the Management API.
- DynamoDB holds rooms, tokens and connection ids.

API Gateway frames cap at 32 KB, which is why couchpad chunks relay payloads at 28 KB. You don't need any chunking logic on the server: forward `relay.data` as is.

::: tip WebSocket idle timeouts
API Gateway closes idle connections after 10 minutes, and many proxies sooner. On a direct link couchpad's pings travel over the DataChannel, so the socket can sit idle. If it closes, couchpad reconnects with backoff and rejoins, and the game keeps going.
:::
