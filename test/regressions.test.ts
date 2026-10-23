// Regression tests for bugs found in review.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Signaling, defaultClock } from '../src/index';
import { FakeBackend, resetFakes } from './fakes';

let backend: FakeBackend;
const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);
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
});
