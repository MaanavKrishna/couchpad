// Phone page: join a room, mount whatever widgets the host sends.
import { CouchClient, mountController, type ControlWidget } from '../../src/index';

const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
const client = new CouchClient({ wsUrl });
const root = document.getElementById('root')!;
const status = document.getElementById('status')!;

let unmount: (() => void) | undefined;
client.onMessage((m) => {
  if (m.t !== 'screen') return;
  unmount?.();
  const widgets = (m.data as { widgets?: ControlWidget[] } | undefined)?.widgets ?? [];
  unmount = mountController(root, widgets, (frame) => client.sendInput(frame));
});
client.on('mode', (mode: string) => { status.textContent = `connected (${mode})`; });
client.on('tv.left', () => { status.textContent = 'host left, waiting...'; });

const room = new URLSearchParams(location.search).get('room') ?? prompt('Room code?') ?? '';
client.join(room, prompt('Your name?') || 'Player').then(
  () => { status.textContent = 'joined, waiting for the host...'; },
  (e: Error) => { status.textContent = `could not join: ${e.message}`; },
);
