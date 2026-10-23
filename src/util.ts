import { PeerMsgSchema, type PeerMsg } from './types';

/** Draw payloads (PNG data URLs) above this are dropped before send. */
export const MAX_DRAW_BYTES = 200 * 1024;

export type Listener = (...args: any[]) => void;

export class Emitter {
  private ls = new Map<string, Set<Listener>>();
  on(ev: string, cb: Listener) {
    let s = this.ls.get(ev);
    if (!s) this.ls.set(ev, (s = new Set()));
    s.add(cb);
  }
  off(ev: string, cb: Listener) { this.ls.get(ev)?.delete(cb); }
  emit(ev: string, ...args: unknown[]) {
    for (const cb of this.ls.get(ev) ?? []) {
      try { cb(...args); } catch (e) { queueMicrotask(() => { throw e; }); }
    }
  }
}

/** Accepts a JSON string (data channel) or an object (relay); returns a validated PeerMsg. */
export function parsePeerMsg(raw: unknown): PeerMsg | undefined {
  let v = raw;
  if (typeof raw === 'string') {
    try { v = JSON.parse(raw); } catch { return undefined; }
  }
  const r = PeerMsgSchema.safeParse(v);
  return r.success ? r.data : undefined;
}

// ---- relay chunking (API Gateway WS frames cap at ~32 KB) ----

/** Max serialized size of one relay payload. */
export const RELAY_CHUNK_BYTES = 28 * 1024;
export const REASSEMBLY_TIMEOUT_MS = 10_000;

export interface RelayChunk { t: '~chunk'; id: number; seq: number; total: number; part: string }

const utf8Len = (s: string) => {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xd800 && c <= 0xdbff ? (i++, 4) : 3;
  }
  return n;
};

let chunkSeq = 0;

/**
 * Returns the relay payloads for `msg`: the message itself when small, else
 * chunks whose serialized envelope is each <= RELAY_CHUNK_BYTES.
 */
export function relayPayloads(msg: unknown): unknown[] {
  const s = JSON.stringify(msg);
  if (utf8Len(s) <= RELAY_CHUNK_BYTES) return [msg];
  const id = ++chunkSeq;
  const budget = RELAY_CHUNK_BYTES - 128; // envelope + relay wrapper headroom
  const parts: string[] = [];
  let i = 0;
  let step = Math.floor(budget / 2);
  while (i < s.length) {
    let n = Math.min(step, s.length - i);
    // escaping/multi-byte chars can inflate a slice: shrink until it fits
    while (n > 1 && utf8Len(JSON.stringify(s.slice(i, i + n))) > budget) n = Math.floor(n * 0.75);
    parts.push(s.slice(i, i + n));
    i += n;
  }
  return parts.map((part, seq) => ({ t: '~chunk', id, seq, total: parts.length, part } satisfies RelayChunk));
}

/** Most chunks one message may be split into; larger messages are not deliverable over relay. */
export const MAX_CHUNKS = 64;
/** Partial messages kept per sender; the oldest is dropped beyond this. */
export const MAX_OPEN_PER_SENDER = 4;

const isChunk = (d: unknown): d is RelayChunk => {
  const c = d as RelayChunk;
  return !!c && typeof c === 'object' && c.t === '~chunk' && Number.isInteger(c.id) && Number.isInteger(c.seq)
    && Number.isInteger(c.total) && c.total > 0 && c.total <= MAX_CHUNKS && c.seq >= 0 && c.seq < c.total
    && typeof c.part === 'string' && c.part.length <= RELAY_CHUNK_BYTES;
};

interface Partial { parts: (string | undefined)[]; got: number; timer: unknown }

/** Reassembles chunked relay payloads per sender; partials expire after 10 s. Memory is bounded per sender. */
export class Reassembler {
  private open = new Map<string, Map<number, Partial>>();
  constructor(private clock: { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(h: unknown): void }) {}

  /** Returns the complete payload (unchunked data passes through), or undefined while incomplete. */
  accept(from: string, data: unknown): unknown {
    if (!isChunk(data)) return data;
    let mine = this.open.get(from);
    if (!mine) this.open.set(from, (mine = new Map()));
    let e = mine.get(data.id);
    if (!e) {
      if (mine.size >= MAX_OPEN_PER_SENDER) this.remove(from, mine.keys().next().value!);
      const id = data.id;
      e = { parts: new Array(data.total), got: 0, timer: this.clock.setTimeout(() => this.remove(from, id), REASSEMBLY_TIMEOUT_MS) };
      mine.set(id, e);
    }
    if (e.parts.length !== data.total || e.parts[data.seq] !== undefined) return undefined;
    e.parts[data.seq] = data.part;
    if (++e.got < data.total) return undefined;
    this.remove(from, data.id);
    try { return JSON.parse(e.parts.join('')); } catch { return undefined; }
  }

  private remove(from: string, id: number) {
    const mine = this.open.get(from);
    const e = mine?.get(id);
    if (!mine || !e) return;
    this.clock.clearTimeout(e.timer);
    mine.delete(id);
    if (mine.size === 0) this.open.delete(from);
  }

  /** Forget a sender's partials (it reconnected: its chunk ids restart and old parts would collide). */
  drop(from: string) {
    for (const id of [...(this.open.get(from)?.keys() ?? [])]) this.remove(from, id);
  }

  clear() {
    for (const mine of this.open.values()) for (const e of mine.values()) this.clock.clearTimeout(e.timer);
    this.open.clear();
  }
}

/** Bounded FIFO for reliable messages while no path is up. */
export class BoundedQueue<T> {
  private items: T[] = [];
  constructor(readonly max = 64) {}
  push(x: T) { if (this.items.length >= this.max) return false; this.items.push(x); return true; }
  drain(): T[] { const x = this.items; this.items = []; return x; }
  get size() { return this.items.length; }
}
