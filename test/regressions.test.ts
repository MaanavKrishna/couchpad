// Regression tests for bugs found in review.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CouchClient, CouchHost, Signaling, defaultClock } from '../src/index';
import { FakeBackend, FakeRTC, MemStorage, resetFakes } from './fakes';

let backend: FakeBackend;
const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const mkHost = () => new CouchHost({
  wsUrl: 'wss://x', household: 'h', WebSocket: backend.WebSocket as any, RTCPeerConnection: FakeRTC as any,
  storage: new MemStorage(),
});
const mkClient = () => new CouchClient({
  wsUrl: 'wss://x', WebSocket: backend.WebSocket as any, random: () => 0.5,
  RTCPeerConnection: FakeRTC as any, storage: new MemStorage(),
});
const openSockets = () => backend.sockets.filter((s) => s.readyState === 1);

beforeEach(() => { vi.useFakeTimers(); resetFakes(); backend = new FakeBackend(); });
afterEach(() => { vi.useRealTimers(); });

describe('regressions', () => {
  test('signaling: a second connect() closes the previous socket and cancels a pending retry', async () => {
    const opens: boolean[] = [];
    const sig = new Signaling({
      url: 'wss://x', WebSocket: backend.WebSocket as any, clock: defaultClock, random: () => 0.5,
      onOpen: (r) => opens.push(r), onMessage: () => {},
    });
    sig.connect();
    await tick(0);
    sig.connect(); // e.g. host.create() called twice
    await tick(0);
    expect(backend.sockets).toHaveLength(2);
    expect(openSockets()).toHaveLength(1);

    openSockets()[0]!.drop(); // schedules a backoff retry
    await tick(0);
    sig.connect(); // manual connect while the retry is pending
    await tick(10_000);
    expect(openSockets()).toHaveLength(1);
    expect(backend.sockets).toHaveLength(3);
    sig.close();
  });

  test('host: malformed server messages never throw into the app', async () => {
    const host = mkHost();
    const p = host.create();
    await tick(0);
    const { code } = await p;
    const ws = backend.sockets[0]!;
    for (const m of [
      { t: 'player.joined' }, { t: 'player.joined', player: null }, { t: 'player.joined', player: 5 },
      { t: 'room.resumed', players: 'x' }, { t: 'room.resumed', players: [null, 3, { name: 'no id' }] },
    ]) {
      expect(() => ws.onmessage!({ data: JSON.stringify(m) })).not.toThrow();
    }
    const client = mkClient();
    const j = client.join(code, 'Ana');
    await tick(0);
    const { playerId } = await j;
    expect(host.players().get(playerId)?.connected).toBe(true);
    expect(host.players().size).toBe(1);
    host.close(); client.close();
  });

  test('host: create() again starts clean, close() rejects a pending open, failed resume stops timers', async () => {
    const host = mkHost();
    const p1 = host.create();
    await tick(0);
    const { code } = await p1;
    const client = mkClient();
    const j = client.join(code, 'Ana');
    await tick(0);
    await j;
    await tick(100);
    expect(host.players().size).toBe(1);
    const oldPcs = FakeRTC.all.length;

    const p2 = host.create();
    expect(host.players().size).toBe(0); // the old room's players are gone
    expect(FakeRTC.all.slice(0, oldPcs).some((pc) => pc.closed)).toBe(true);
    await tick(0);
    const { code: code2 } = await p2;
    expect(code2).not.toBe(code);
    expect(backend.sockets.filter((s) => s.readyState === 1 && backend.conns.get(s)?.role === 'tv')).toHaveLength(1);
    client.close();

    const pending = host.create();
    host.close();
    await expect(pending).rejects.toThrow('host.closed');

    const storage = new MemStorage();
    storage.setItem('couchpad.tv.ZZZZ', 'nope');
    const h2 = new CouchHost({ wsUrl: 'wss://x', household: 'h', WebSocket: backend.WebSocket as any, storage });
    const r = h2.resume('ZZZZ');
    r.catch(() => {});
    await tick(0);
    await expect(r).rejects.toThrow('room.notFound');
    expect(vi.getTimerCount()).toBe(0); // no ping interval left running
  });
});
