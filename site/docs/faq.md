# FAQ and troubleshooting

## Does the player need to install anything?

No. The phone opens a web page from the QR code. couchpad only needs a browser with WebSocket support. WebRTC is used when available.

## Why is my link on `relay` instead of `direct`?

couchpad tries WebRTC first and gives up after 4 s. Common reasons it does not connect:

- **NAT.** couchpad only configures a public STUN server (`stun:stun.l.google.com:19302`) by default. STUN finds a path through most home routers, but symmetric NATs and carrier-grade NAT on mobile data need a TURN server. Pass your own with `iceServers`:

  ```ts
  new CouchHost({ wsUrl, household, iceServers: [
    { urls: 'stun:stun.example.com:3478' },
    { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' } as any,
  ] });
  ```

- **Phone on mobile data, TV on Wi-Fi.** They are on different networks, so a direct path needs STUN to work on both sides, or TURN.
- **Corporate or school networks** that block UDP.

When none of that works, the relay carries everything. Games keep working with a little more latency.

## WebRTC fails on hotel Wi-Fi

Hotel, conference and guest networks usually enable **client isolation**: devices on the same Wi-Fi cannot talk to each other. ICE never finds a path between the phone and the TV, so:

1. the phone offers WebRTC and keeps sending input through the relay while it waits,
2. after 4 s (`OPEN_TIMEOUT_MS`) the peer fails over, and the relay is used for the rest of the session,
3. large payloads such as drawings are chunked at 28 KB.

Nothing to do on your side. To skip the 4 s attempt on a network you know is isolated, use `transport: 'relay-only'` on the client and host. Many games expose this as an environment flag such as `TRANSPORT=relay-only`.

## Fire TV WebView notes

couchpad was built on a Fire TV Stick HD, where the host runs in an Android WebView.

- **`RTCPeerConnection` may be missing** in some WebViews. When it is, the host skips WebRTC and the phones fall back to the relay after their 4 s timeout. Pass `transport: 'relay-only'` on the host to make that explicit.
- **`sessionStorage` can be cleared** when the app is killed. To resume rooms across a cold start, pass a `storage` that writes to `localStorage` or native storage.
- **Keep the host page awake.** Fire OS can pause a backgrounded WebView, which closes its socket. Phones see `tv.left` and wait; when the app returns, `resume()` gets the room back and phones go direct again.
- **Latency.** On a home network Cadabra measured 13 to 16 ms from phone to Fire TV over the DataChannel.

## A button stays pressed on the TV

It should not. Held input is resent every 100 ms, a release is sent twice (30 ms apart), and the widgets send a zeroed frame on blur, a hidden tab and unmount. If you build frames yourself instead of using `mountController`, send a frame with every button `false` when your UI loses focus.

## Tilt does nothing

Tilt needs a secure context (HTTPS). On iOS the widget shows an "Enable tilt" button because Safari requires a tap before asking for motion permission. If permission is denied, or no orientation event arrives within 1.5 s, the tilt widget turns into a joystick.

## The phone refreshed and got a new seat

Rejoin tokens are stored in `sessionStorage` per room code. A new tab, a private window or a different browser has no token. Check that your server returns the same `playerId` for a `room.join` with a valid `rejoinToken`.

## `join()` rejects with `join.timeout`

No `room.joined` arrived within 8 s. Check the `wsUrl` (use `wss://` from an HTTPS page) and that the server answers `room.join`.

## How many players can join?

couchpad has no limit. The example server allows 8. Cadabra runs 4 phones on a Fire TV Stick HD.

## Can I send my own messages?

Yes. Use `{ t: 'screen', name, data }` peer messages with your own `name` values, which arrive as `msg` events on the host and `onMessage` on the phone. You can also put your own server messages on the same socket; couchpad ignores unknown `t` values.
