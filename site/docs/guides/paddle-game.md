# Build a two-player paddle game

A complete game in about 50 lines: two phones each get a joystick, and the TV draws two paddles and a ball on a canvas. It uses only the public API.

You need the [signaling server from Getting started](../getting-started#_2-start-a-signaling-server) running.

## The TV

The TV seats the first two players, sends each a joystick, and runs the game loop. It reads the latest `axes.y` per player, so it never depends on how many frames arrived.

::: code-group

```ts [tv.ts]
import { CouchHost, type InputFrame } from 'couchpad';

const WS = `ws://${location.hostname}:8787/ws`;
const host = new CouchHost({ wsUrl: WS, household: 'paddles' });
const seats: string[] = [];                       // [left, right] player ids
const stick = new Map<string, number>();          // latest axes.y per player
const pad = [0.5, 0.5], score = [0, 0];
let ball = { x: 0.5, y: 0.5, vx: 0.006, vy: 0.004 };

host.on('player', (id: string) => {
  if (!seats.includes(id) && seats.length < 2) seats.push(id);
  host.sendTo(id, { t: 'screen', name: 'play', data: { widgets: [{ kind: 'joystick', id: 'paddle' }] } });
});
host.on('input', (id: string, f: InputFrame) => { if (f.axes) stick.set(id, f.axes.y); });

const { code } = await host.create();
const cv = document.querySelector('canvas')!, g = cv.getContext('2d')!;

function tick() {
  seats.forEach((id, i) => { pad[i] = Math.min(0.9, Math.max(0.1, pad[i]! + (stick.get(id) ?? 0) * 0.02)); });
  ball.x += ball.vx; ball.y += ball.vy;
  if (ball.y < 0 || ball.y > 1) ball.vy *= -1;
  for (const [i, x] of [[0, 0.04], [1, 0.96]] as const) {
    if (Math.abs(ball.x - x) < 0.01 && Math.abs(ball.y - pad[i]!) < 0.1) ball.vx *= -1.05;
  }
  if (ball.x < 0 || ball.x > 1) {
    score[ball.x < 0 ? 1 : 0]!++;
    ball = { x: 0.5, y: 0.5, vx: ball.x < 0 ? 0.006 : -0.006, vy: 0.004 };
  }
  const W = cv.width, H = cv.height;
  g.fillStyle = '#0d0f1e'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#4cc9f0';
  pad.forEach((y, i) => g.fillRect(i ? W * 0.96 : W * 0.03, (y - 0.1) * H, W * 0.01, H * 0.2));
  g.fillStyle = '#ffd166'; g.fillRect(ball.x * W - 6, ball.y * H - 6, 12, 12);
  g.fillStyle = '#e9eaf6'; g.font = '32px system-ui'; g.textAlign = 'center';
  g.fillText(seats.length < 2 ? `Join room ${code}` : `${score[0]}  :  ${score[1]}`, W / 2, 48);
  requestAnimationFrame(tick);
}
tick();
```

```html [tv.html]
<!doctype html>
<style>body { margin: 0; background: #0d0f1e; } canvas { width: 100vw; height: 100vh; display: block; }</style>
<canvas width="1280" height="720"></canvas>
<script type="module" src="./tv.ts"></script>
```

:::

## The phone

The phone page is the same as in Getting started: it renders whatever screen the TV sends.

::: code-group

```ts [phone.ts]
import { CouchClient, mountController, type ControlWidget } from 'couchpad';

const client = new CouchClient({ wsUrl: `ws://${location.hostname}:8787/ws` });
let unmount: (() => void) | undefined;
client.onMessage((m) => {
  if (m.t !== 'screen') return;
  unmount?.();
  unmount = mountController(document.body, (m.data as { widgets: ControlWidget[] }).widgets, (f) => client.sendInput(f));
});
await client.join(new URLSearchParams(location.search).get('room') ?? '', 'Player');
```

```html [phone.html]
<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>html, body { margin: 0; height: 100%; background: #0d0f1e; }</style>
<script type="module" src="./phone.ts"></script>
```

:::

## Run it

```bash
npx vite --host
```

Open `tv.html` on the computer or TV, then `phone.html?room=CODE` on two phones. The first two phones get a paddle; later phones still get a joystick but no seat.

## How it works

- **Latest value wins.** Continuous frames are lossy and may arrive at up to 30 Hz, so the game keeps only the latest `axes.y` per player and reads it once per animation frame.
- **Nothing sticks.** If a phone locks mid-move, its widgets send a zeroed frame, so the paddle stops instead of drifting.
- **Seats survive refreshes.** A refreshed phone rejoins with its token and gets the same id, so it keeps its paddle. `player` fires again and the TV resends the joystick.

## Make it yours

- Add a `button` widget and read `f.buttons?.serve` to serve the ball.
- Call `host.resume().catch(() => host.create())` instead of `create()` so a TV reload keeps the room.
- Show `host.players().get(id)?.rttMs` next to each score to watch latency.
