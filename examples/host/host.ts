// Host page: the "TV". Creates a room, shows the join URL, draws one square per player.
import { CouchHost } from '../../src/index';

const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
const host = new CouchHost({ wsUrl, household: 'demo' });
const status = document.getElementById('status')!;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const pos = new Map<string, { x: number; y: number; vx: number; vy: number; hue: number; jump: number }>();

host.on('player', (id: string, info: { name: string }) => {
  pos.set(id, { x: 100 + pos.size * 60, y: 200, vx: 0, vy: 0, hue: pos.size * 70, jump: 0 });
  status.textContent = `${info.name} joined (${pos.size} players)`;
  host.sendTo(id, {
    t: 'screen', name: 'play',
    data: { widgets: [{ kind: 'joystick', id: 'move' }, { kind: 'button', id: 'jump', label: 'JUMP' }] },
  });
});
host.on('left', (id: string) => pos.delete(id));
host.on('input', (id: string, f: { axes?: { x: number; y: number }; buttons?: Record<string, boolean> }) => {
  const p = pos.get(id);
  if (!p) return;
  if (f.axes) { p.vx = f.axes.x * 240; p.vy = f.axes.y * 240; }
  if (f.buttons?.jump) p.jump = 0.25;
});

function frame(prev: number) {
  const now = performance.now();
  const dt = Math.min(0.05, (now - prev) / 1000);
  ctx.fillStyle = '#10121c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const [id, p] of pos) {
    p.x = Math.max(20, Math.min(canvas.width - 20, p.x + p.vx * dt));
    p.y = Math.max(20, Math.min(canvas.height - 20, p.y + p.vy * dt));
    p.jump = Math.max(0, p.jump - dt);
    const r = 18 + p.jump * 60;
    ctx.fillStyle = `hsl(${p.hue} 80% 60%)`;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    const v = host.players().get(id);
    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui';
    ctx.fillText(`${v?.name ?? id} · ${v?.transport} · ${Math.round(v?.rttMs ?? 0)} ms`, p.x - 40, p.y - r - 8);
  }
  requestAnimationFrame(() => frame(now));
}

host.create().then(({ code }) => {
  const url = `${location.origin}/phone.html?room=${code}`;
  status.innerHTML = `Room <b>${code}</b> &mdash; open <a href="${url}">${url}</a> on your phone (same Wi-Fi)`;
  frame(performance.now());
});
