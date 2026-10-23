# Error codes

couchpad reports failures as `Error` objects whose `message` is a short code. Promises reject with them, and after joining, server errors arrive as `error` events with the code as the argument.

```ts
try {
  await client.join(code, name);
} catch (e) {
  switch ((e as Error).message) {
    case 'room.notFound': return showMessage('Check the code on the TV.');
    case 'room.full': return showMessage('This room is full.');
    default: return showMessage('Could not join. Try again.');
  }
}
```

## Client (phone)

Rejections of `CouchClient.join()`.

| Code | When | What to do |
|---|---|---|
| `join.timeout` | No `room.joined` within `joinTimeoutMs` (8 s) | Check `wsUrl`, and that the server answers `room.join` |
| `join.superseded` | `join()` was called again before this one finished | Nothing; the newer call wins |
| `join.closed` | `close()` was called while joining | Nothing; you closed it |
| `room.*` | The server refused the join (see below) | Depends on the code. Any code except `room.full` also clears the stored rejoin token |

## Host (TV)

Rejections of `CouchHost.create()` and `CouchHost.resume()`.

| Code | When | What to do |
|---|---|---|
| `room.badToken` | `resume()` found no stored TV token, or the server rejected it | Call `create()` instead |
| `room.notFound` | `resume()` asked for a room the server no longer has | Call `create()` instead |
| `host.superseded` | `create()` or `resume()` was called again before this one settled | Nothing; the newer call wins |
| `host.closed` | `close()` was called while `create()` or `resume()` was pending | Nothing; you closed it |

When a resume is refused, the host forgets the stored token and stops its socket, so falling back is safe:

```ts
const { code } = await host.resume().catch(() => host.create());
```

## Server errors

The signaling server sends `{t:'error', code, message?}`. These are the codes couchpad knows about; servers may add their own, which are passed through unchanged.

| Code | Meaning |
|---|---|
| `room.notFound` | No room with that code |
| `room.full` | The room has no free seat (the example server allows 8) |
| `room.badRequest` | The message was malformed |
| `room.notInRoom` | A `signal` or `relay` came from a connection that has not joined a room |
| `room.targetGone` | The host addressed a player whose socket is closed |
| `room.badToken` | The `tvToken` did not match |
| `room.rateLimited` | The connection sent too many messages |

After a successful join or create, these arrive as events rather than rejections:

```ts
client.on('error', (code: string) => console.warn('server error', code));
host.on('error', (code: string) => console.warn('server error', code));
```

## Send results

`send()` and `sendTo()` return `false` instead of throwing:

| Method | Returns `false` when |
|---|---|
| `client.send(msg)` | The reliable queue is full (64), or `msg` would need more than 64 relay chunks |
| `host.sendTo(id, msg)` | The player is unknown or has left, the queue is full, or `msg` would need more than 64 relay chunks |
