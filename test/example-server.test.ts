// End-to-end check of the reference signaling server in examples/server (relay-only, no WebRTC).
import { it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { CouchHost, CouchClient, type InputFrame } from '../src/index';

it('example server: create, join, input and screen round trip over relay', async () => {
  const srv = spawn('node', ['examples/server/server.mjs'], { env: { ...process.env, PORT: '8798' } });
  try {
    await new Promise((r) => setTimeout(r, 800));
    const wsUrl = 'ws://localhost:8798/ws';
    const host = new CouchHost({ wsUrl, household: 'test', WebSocket: WebSocket as never, transport: 'relay-only' });
    const { code } = await host.create();
    const phone = new CouchClient({ wsUrl, WebSocket: WebSocket as never, transport: 'relay-only' });
    const inputs: InputFrame[] = [];
    const screens: unknown[] = [];
    host.on('input', (_id: string, f: InputFrame) => inputs.push(f));
    host.on('player', (id: string) => host.sendTo(id, { t: 'screen', name: 'play' }));
    phone.onMessage((m) => screens.push(m));
    await phone.join(code, 'Ann');
    phone.sendInput({ t: 1, axes: { x: 1, y: 0 } });
    await new Promise((r) => setTimeout(r, 500));
    expect(inputs.length).toBeGreaterThan(0);
    expect(screens[0]).toMatchObject({ t: 'screen', name: 'play' });
    phone.close();
    host.close();
  } finally {
    srv.kill();
  }
});
