# Debugging connections

Most connection problems are one of three things: the phone can't reach your server, the server isn't routing correctly, or WebRTC can't find a path and the session is on the relay. This page goes through them in that order.

## 1. Can the phone reach the server?

Listen for failures on the phone:

```ts
client.join(code, name).catch((e: Error) => console.error('join failed:', e.message));
client.on('link', (s: 'down' | 'up') => console.log('socket', s));
client.on('error', (code: string) => console.error('server error', code));
```

| Symptom | Likely cause |
|---|---|
| `join.timeout` after 8 s | Wrong `wsUrl`, a firewall, or `ws://` from an `https://` page (mixed content is blocked) |
| `room.notFound` | Wrong code, or the server restarted and lost the room |
| `room.full` | No free seat |
| `link` goes `down` and `up` repeatedly | A proxy is closing the socket. Check its idle and upgrade settings |

## 2. Is the session direct or relayed?

```ts
client.on('mode', (m: 'direct' | 'relay') => console.log('phone transport:', m));
setInterval(() => {
  for (const [id, p] of host.players()) console.log(id, p.transport, `${p.rttMs} ms`);
}, 2000);
```

`direct` is the WebRTC DataChannel. `relay` means traffic goes through your server, which always works but adds a hop. A phone always starts on `relay` and switches to `direct` once both channels open, usually within a second.

## 3. Why didn't WebRTC connect?

couchpad gives up on direct when the channels are not open within **4 s**, when the connection state becomes `failed` or `closed`, or when it stays `disconnected` for over **2 s**. Common causes:

| Cause | What you'll see | Fix |
|---|---|---|
| Client isolation (hotel, conference, guest Wi-Fi) | `relay` after 4 s, every time | Nothing; the relay is the fallback. Or force it (below) |
| Phone on mobile data, TV on Wi-Fi | Often `relay` | Add a TURN server |
| Symmetric or carrier-grade NAT | `relay` | Add a TURN server |
| UDP blocked (corporate networks) | `relay` | TURN over TCP or TLS on port 443 |
| No `RTCPeerConnection` (some WebViews) | `relay` immediately on the host | Expected; see the [FAQ](../faq#fire-tv-webview-notes) |

Open <kbd>chrome://webrtc-internals</kbd> on desktop Chrome (or remote-debug the phone) to see ICE candidates and the selected pair.

### Add a TURN server

```ts
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:443'] },
];
new CouchHost({ wsUrl, household, iceServers });
new CouchClient({ wsUrl, iceServers });
```

::: warning Credentials
The `iceServers` option is typed as `{ urls }` only. If your TURN server needs a username and credential, cast the entries (`as any`) or use a server that authenticates by URL.
:::

## 4. Force the relay

To skip the 4 s WebRTC attempt on a network you know is isolated, or to test the relay path on purpose:

```ts
const transport = new URLSearchParams(location.search).has('relay') ? 'relay-only' : 'auto';
new CouchClient({ wsUrl, transport });
new CouchHost({ wsUrl, household, transport });
```

Then open `phone.html?room=KMPV&relay`. Setting it on the phone is enough; setting it on the host too makes it skip answering offers.

## 5. Is the relay working?

If the session is on `relay` and input still does not arrive, check the server:

- It forwards `{t:'relay', to, data}` to the target as `{t:'relay', from, data}` with `data` unchanged.
- It accepts frames of at least 32 KB. Chunks are up to about 28 KB of data.
- It routes phones' messages only to the TV of their room.

Large messages are split into `~chunk` envelopes. If a chunked message never arrives, look for a dropped chunk: partials are thrown away after 10 s, and a message that would need more than 64 chunks is refused at send time (`send()` returns `false`).

## 6. Latency

`rttMs` is the round trip measured by a ping every 2 s. On a home network, Cadabra measured 13 to 16 ms phone to Fire TV over the DataChannel. If you see much more on `direct`, the Wi-Fi is congested. On `relay`, latency is two trips to your server.
