// Regression tests for bugs found in review.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  CouchClient, CouchHost, MAX_OPEN_PER_SENDER, RELAY_CHUNK_BYTES, Reassembler, Signaling, defaultClock,
} from '../src/index';
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

  test('reassembler: memory is bounded per sender and a reconnect drops stale partials', () => {
    const r = new Reassembler(defaultClock);
    const c = (id: number, seq: number, part: string, total = 2) => ({ t: '~chunk', id, seq, total, part });
    // an oversized part is not treated as a chunk (it passes through and fails PeerMsg validation)
    const big = c(1, 0, 'x'.repeat(RELAY_CHUNK_BYTES + 1));
    expect(r.accept('a', big)).toBe(big);
    expect(vi.getTimerCount()).toBe(0); // no partial buffered
    expect(r.accept('a', c(1, 1, '1}'))).toBeUndefined();
    expect(vi.getTimerCount()).toBe(1);
    r.clear();
    expect(vi.getTimerCount()).toBe(0);
    // at most MAX_OPEN_PER_SENDER partials per sender; the oldest are evicted
    for (let id = 1; id <= MAX_OPEN_PER_SENDER + 3; id++) r.accept('a', c(id, 0, '{"v":'));
    expect(vi.getTimerCount()).toBe(MAX_OPEN_PER_SENDER);
    expect(r.accept('a', c(1, 1, '1}'))).toBeUndefined(); // evicted
    expect(r.accept('a', c(MAX_OPEN_PER_SENDER + 3, 1, '7}'))).toEqual({ v: 7 });
    r.clear();
    // a reconnected sender restarts its ids: old parts must not mix into the new message
    r.accept('b', c(1, 0, '{"old":'));
    r.drop('b');
    expect(vi.getTimerCount()).toBe(0);
    expect(r.accept('b', c(1, 1, '2}'))).toBeUndefined();
    expect(r.accept('b', c(1, 0, '{"new":'))).toEqual({ new: 2 });
  });
});
