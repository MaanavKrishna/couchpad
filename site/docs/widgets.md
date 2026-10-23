# Widgets

couchpad's widgets are framework-free DOM controls built for thumbs: pointer capture, haptics, a portrait one-thumb layout and CSS-variable theming. The host describes them as data, and the phone draws them.

## Gallery

Each card shows the widget with couchpad's default theme, the `ControlWidget` that produces it, and what it adds to an `InputFrame`.

<WidgetGallery />

## mountController

```ts
function mountController(
  host: HTMLElement,
  widgets: ControlWidget[],
  onFrame: (f: InputFrame) => void,
  opts?: MountOpts,
): () => void;

interface MountOpts {
  now?: () => number; // timestamp source, default performance.now()
}
```

It lays out the widgets in three zones (panels on top, actions in the middle, the stick nearest the thumb) and calls `onFrame` with merged frames. Continuous frames carry every joystick, tilt and button value at once. One-shot frames carry a single `swipe`, `draw`, `vote` or `text`.

It returns `unmount()`. Unmounting mid-hold always sends one zeroed frame so nothing stays pressed on the TV. Window blur and a hidden tab release everything as well.

```ts
const unmount = mountController(root, [
  { kind: 'joystick', id: 'move' },
  { kind: 'button', id: 'fire', label: 'FIRE' },
  { kind: 'hold', id: 'charge', label: 'CHARGE' },
], (f) => client.sendInput(f));

// later
unmount();
```

## Widget kinds

| Kind | Fields | Emits | Notes |
|---|---|---|---|
| `joystick` | `id` | `axes: {x, y}` in -1..1 | Deadzone 0.08, full deflection at 80% of the pad's half-size. Exposes `aria-roledescription="joystick"` and a value text |
| `button` | `id`, `label` (≤ 20) | `buttons[id]: boolean` | True on down, false on up, with a ripple |
| `hold` | `id`, `label` (≤ 20) | `buttons[id]: boolean` | Same edges as a button, with a charging visual |
| `tilt` | `id` | `tilt: {x, y}` in -1..1 | Full deflection at 30°. Recalibrates on screen rotation. On iOS it shows an "Enable tilt" button for the permission prompt. Falls back to a joystick if permission is denied or no orientation event arrives within 1.5 s |
| `swipe` | `id` | `swipe: 'up' \| 'down' \| 'left' \| 'right'` | 36 px threshold. Ignores `pointercancel` |
| `draw` | `id`, `prompt` (≤ 80) | `draw: string` (data URL) | Four colours. Exports a JPEG of at most 256 px, lowering quality until it is ≤ 25 KB. Without a canvas it falls back to a 128 px 4-bit PNG |
| `vote` | `id`, `options` (2 to 6, each ≤ 40) | `vote: number` (index) | A `radiogroup` of `radio` buttons |
| `text` | `id`, `placeholder` (≤ 60) | `text: string` | Capped at 40 characters (`TEXT_MAX`) with a live counter |

## Theming

Set CSS variables on any ancestor of the controller:

```css
#root {
  --cp-primary: #4cc9f0;    /* default #7c5cff */
  --cp-accent: #ffd166;     /* default #ffb547 */
  --cp-glow: #4cc9f0;       /* default #8f6bff */
  --cp-text: #ffffff;       /* default #f5f3ff */
  --cp-surface: rgba(255, 255, 255, 0.06);
  --cp-font: 'IBM Plex Sans', system-ui, sans-serif;
  --cp-display-font: 'Bricolage Grotesque', var(--cp-font);
}
```

The stylesheet is injected once by `ensureStyles(doc = document)`. `WIDGET_CSS` is exported if you would rather ship it yourself, for example under a strict CSP.

## Factories

Every widget has a factory if you want to build your own layout. Each returns a `Widget`:

```ts
interface Widget {
  el: HTMLElement;
  release?(): void; // drop held state silently; the owner sends the zeroed frame
  destroy(): void;
}
```

| Factory | Options |
|---|---|
| `createJoystick(o: JoystickOpts)` | `{ id, onChange(a: Axes), onPress?, reach?, deadzone? }` |
| `createButton(o: ButtonOpts)` | `{ id, label, onChange(down), onPress?, variant?: 'tap' \| 'hold' }` |
| `createHold(o)` | `ButtonOpts` without `variant` |
| `createTilt(o: TiltOpts)` | `{ id, onChange(a: Axes), onPress?, range?, probeMs? }` |
| `createSwipe(o: SwipeOpts)` | `{ id, onSwipe(d: SwipeDir), threshold? }` |
| `createDraw(o: DrawOpts)` | `{ id, prompt, onDone(png: string), onPress? }` |
| `createVote(o: VoteOpts)` | `{ id, options, onVote(i), onPress? }` |
| `createText(o: TextOpts)` | `{ id, placeholder, onSend(text), onPress? }` |

```ts
import { createJoystick, ensureStyles } from 'couchpad';

ensureStyles();
const stick = createJoystick({ id: 'aim', onChange: ({ x, y }) => aim(x, y), deadzone: 0.12 });
document.querySelector('#left')!.append(stick.el);
```

## Pure helpers

These have no DOM dependency and are handy in tests or custom widgets.

```ts
toAxes(dx: number, dy: number, radius: number, deadzone = 0.08): Axes
swipeDir(dx: number, dy: number, threshold: number): SwipeDir | undefined
tiltAxes(beta: number, gamma: number, base: { beta: number; gamma: number }, angle: number, range = 30): Axes
rasterize(strokes: Stroke[], size = DRAW_SIZE): Uint8Array
exportJpeg(strokes: Stroke[]): string | undefined
exportDrawing(strokes: Stroke[]): string            // JPEG, else PNG fallback
encodeIndexedPng(w: number, h: number, pixels: Uint8Array, palette: string[]): string // ≤ 15 colours
clamp(v: number, lo: number, hi: number): number
haptic(pattern: number | number[] = PRESS_HAPTIC_MS): void
```

```ts
swipeDir(80, -10, 36);   // 'right'
toAxes(0, -200, 100);     // { x: 0, y: -1 }
```

DOM helpers used by the widgets are exported too: `el(tag, cls?, attrs?, text?)`, `on(target, type, fn, opts?)` (returns its remover), `capture(target, pointerId)` and `ripple(host, e)`. `WidgetEnv` and `Axes` are the shared types.

| Constant | Value |
|---|---|
| `PRESS_HAPTIC_MS` | `15` |
| `DRAW_SIZE` | `128` (PNG fallback) |
| `EXPORT_SIZE` | `256` (JPEG long side) |
| `MAX_EXPORT_BYTES` | `25 * 1024` |
| `DRAW_COLORS` | `['#ffffff', '#ff4d6d', '#ffd166', '#4cc9f0']` |
| `TEXT_MAX` | `40` |
