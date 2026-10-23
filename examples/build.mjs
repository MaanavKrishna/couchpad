// Bundles the example pages into examples/dist (served by examples/server/server.mjs).
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('examples/dist', { recursive: true });
await build({
  entryPoints: { host: 'examples/host/host.ts', phone: 'examples/phone/phone.ts' },
  bundle: true, format: 'esm', target: 'es2022', outdir: 'examples/dist', sourcemap: false,
});
cpSync('examples/host/host.html', 'examples/dist/host.html');
cpSync('examples/phone/phone.html', 'examples/dist/phone.html');
console.log('built examples/dist');
