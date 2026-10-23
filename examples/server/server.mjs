// Minimal reference signaling server for couchpad (rooms, WebRTC signaling, relay fallback).
// Run: npm run example   -> http://localhost:8787  (host page)  and  /phone.html  (controller)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8787);
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const ALPHABET = 'BCDFGHJKLMNPQRSTVWXZA'; // matches ROOM_CODE_RE in couchpad
const MAX_PLAYERS = 8;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

/** @type {Map<string, {tv?: import('ws').WebSocket, tvToken: string, players: Map<string, {id: string, name: string, token: string, ws?: import('ws').WebSocket}>}>} */
const rooms = new Map();
/** socket -> { code, role: 'tv' | 'player', playerId? } */
const conns = new Map();

const send = (ws, m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
const token = () => randomBytes(12).toString('hex');
const newCode = () => {
  for (;;) {
    const c = Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
    if (!rooms.has(c)) return c;
  }
};
const live = (room) => [...room.players.values()].filter((p) => p.ws).map(({ id, name }) => ({ id, name }));

function handle(ws, m) {
  const me = conns.get(ws);
  switch (m.t) {
    case 'ping': return send(ws, { t: 'pong' });
    case 'room.create': {
      const code = newCode();
      const room = { tv: ws, tvToken: token(), players: new Map() };
      rooms.set(code, room);
      conns.set(ws, { code, role: 'tv' });
      return send(ws, { t: 'room.created', code, tvToken: room.tvToken });
    }
    case 'room.resume': {
      const room = rooms.get(m.code);
      if (!room || room.tvToken !== m.tvToken) return send(ws, { t: 'error', code: room ? 'room.badToken' : 'room.notFound' });
      room.tv = ws;
      conns.set(ws, { code: m.code, role: 'tv' });
      send(ws, { t: 'room.resumed', players: live(room) });
      for (const p of room.players.values()) send(p.ws, { t: 'tv.back' });
      return;
    }
    case 'room.join': {
      const code = String(m.code).toUpperCase();
      const room = rooms.get(code);
      if (!room) return send(ws, { t: 'error', code: 'room.notFound' });
      let p = m.rejoinToken && [...room.players.values()].find((x) => x.token === m.rejoinToken);
      if (p) {
        if (p.ws && p.ws !== ws) conns.delete(p.ws);
        p.ws = ws;
      } else {
        if (live(room).length >= MAX_PLAYERS) return send(ws, { t: 'error', code: 'room.full' });
        p = { id: `p${room.players.size + 1}`, name: String(m.name || 'Player').slice(0, 40), token: token(), ws };
        room.players.set(p.id, p);
      }
      conns.set(ws, { code, role: 'player', playerId: p.id });
      send(ws, { t: 'room.joined', playerId: p.id, token: p.token, name: p.name });
      send(room.tv, { t: 'player.joined', player: { id: p.id, name: p.name } });
      if (!room.tv || room.tv.readyState !== 1) send(ws, { t: 'tv.left' });
      return;
    }
    case 'signal':
    case 'relay': {
      if (!me) return send(ws, { t: 'error', code: 'room.notInRoom' });
      const room = rooms.get(me.code);
      if (!room) return;
      if (me.role === 'player') {
        // Phones may only talk to the TV.
        if (m.to !== 'tv') return;
        return send(room.tv, { t: m.t, from: me.playerId, data: m.data });
      }
      const target = room.players.get(m.to);
      if (!target?.ws) return send(ws, { t: 'error', code: 'room.targetGone' });
      return send(target.ws, { t: m.t, from: 'tv', data: m.data });
    }
  }
}

const http = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  const file = normalize(path === '/' ? '/host.html' : path).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found (run `npm run example:build` first)');
  }
});

const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 128 * 1024 });
wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try { handle(ws, JSON.parse(String(raw))); } catch { /* ignore malformed frames */ }
  });
  ws.on('close', () => {
    const me = conns.get(ws);
    conns.delete(ws);
    const room = me && rooms.get(me.code);
    if (!room) return;
    if (me.role === 'tv' && room.tv === ws) {
      room.tv = undefined;
      for (const p of room.players.values()) send(p.ws, { t: 'tv.left' });
    } else if (me.role === 'player') {
      const p = room.players.get(me.playerId);
      if (p?.ws === ws) { p.ws = undefined; send(room.tv, { t: 'player.left', playerId: p.id }); }
    }
  });
});

http.listen(PORT, () => console.log(`couchpad example on http://localhost:${PORT}  (phone: /phone.html)`));
