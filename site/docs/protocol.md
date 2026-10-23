# Protocol messages

couchpad expects a small JSON protocol over one WebSocket per device. Every message is an object with a string `t`. The server identifies the host connection as `'tv'` and each phone by a `playerId` it assigns.

## Client to server

| Message | From | Meaning |
|---|---|---|
| `{t:'room.create', household?}` | host | Make a room |
| `{t:'room.resume', code, tvToken}` | host | Reclaim a room after a reload or reconnect |
| `{t:'room.join', code, name, rejoinToken?}` | phone | Join, or take back a seat with the token |
| `{t:'signal', to, data}` | both | WebRTC offer, answer or candidate. Phones send `to:'tv'`, the host sends `to:<playerId>` |
| `{t:'relay', to?, data}` | both | Fallback transport, same addressing as `signal` |
| `{t:'ping'}` | both | Socket keepalive; answer `{t:'pong'}` |

## Server to client

| Message | To | Meaning |
|---|---|---|
| `{t:'room.created', code, tvToken}` | host | `code` is 4 letters from `BCDFGHJKLMNPQRSTVWXZA` |
| `{t:'room.resumed', players?:[{id,name,avatar?}]}` | host | After a resume, this live list is the truth |
| `{t:'room.joined', playerId, token, name}` | phone | `token` is the rejoin token |
| `{t:'player.joined', player}` | host | A phone joined or rejoined |
| `{t:'player.left', playerId}` | host | A phone's socket closed |
| `{t:'tv.left'}` / `{t:'tv.back'}` | phones | Host presence. Phones re-offer WebRTC on `tv.back` |
| `{t:'signal' \| 'relay', from, data}` | either | `from` is `'tv'` or a `playerId`. The server sets it; never trust the sender |
| `{t:'pong'}` | either | Reply to `ping` |
| `{t:'error', code, message?}` | either | See below |

Unknown `t` values are ignored, so you can multiplex your own game events on the same socket.

### Error codes

`room.notFound`, `room.full`, `room.badRequest`, `room.notInRoom`, `room.targetGone`, `room.badToken`, `room.rateLimited`. Servers may add their own; couchpad passes unknown codes through as is.

## Peer messages

These travel inside a DataChannel as JSON strings, or as objects inside `relay.data`. Both sides validate them with `PeerMsgSchema`.

```ts
{ t: 'input', frame: InputFrame }
{ t: 'screen', name: string, data?: unknown }
{ t: 'ping', id: number }
{ t: 'pong', id: number }
```

## Signal payloads

```ts
{ kind: 'offer' | 'answer', sdp: string }
{ kind: 'candidate', candidate: RTCIceCandidateInit }
```

## Relay chunks

Relay payloads over 28 KB are split before sending:

```ts
{ t: '~chunk', id: number, seq: number, total: number, part: string }
```

`total` is at most 64 and `seq` is 0-based. The receiver reassembles per sender and chunk `id` and drops partials after 10 s. A server only forwards `relay.data`, so it needs no chunking logic.

## A complete session

```
TV     → server  {t:'room.create', household:'living-room'}
server → TV      {t:'room.created', code:'KMPV', tvToken:'…'}
phone  → server  {t:'room.join', code:'KMPV', name:'Asha'}
server → phone   {t:'room.joined', playerId:'p1', token:'…', name:'Asha'}
server → TV      {t:'player.joined', player:{id:'p1', name:'Asha'}}
phone  → server  {t:'signal', to:'tv', data:{kind:'offer', sdp:'…'}}
server → TV      {t:'signal', from:'p1', data:{kind:'offer', sdp:'…'}}
TV     → server  {t:'signal', to:'p1', data:{kind:'answer', sdp:'…'}}
server → phone   {t:'signal', from:'tv', data:{kind:'answer', sdp:'…'}}
  … candidates both ways …
phone ⇄ TV       DataChannels 'input' and 'state' open: mode 'direct'
TV    → phone    {t:'screen', name:'play', data:{widgets:[…]}}
phone → TV       {t:'input', frame:{t:1234.5, axes:{x:0.4, y:-1}}}
```
