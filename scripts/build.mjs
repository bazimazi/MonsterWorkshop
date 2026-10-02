import { spawnSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep, basename } from 'node:path';
const workspace = resolve(import.meta.dirname, '..');
process.chdir(workspace);
const output = resolve(workspace, 'dist');
if (!output.startsWith(workspace + sep) || basename(output) !== 'dist')
  throw new Error('Build output must stay inside the project dist directory');
await rm(output, { recursive: true, force: true });
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc'], {
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('content', 'dist/content', { recursive: true });
const entries = await readdir('dist', { recursive: true, withFileTypes: true });
const assets = entries
  .filter((e) => e.isFile() && e.name !== 'service-worker.js')
  .map((e) => (e.parentPath + '/' + e.name).replaceAll('\\', '/').replace(/^dist\//, ''))
  .sort();
const revision = createHash('sha256');
for (const asset of assets) revision.update(await readFile('dist/' + asset));
await writeFile(
  'dist/service-worker.js',
  `
const CACHE = 'monster-workshop-${revision.digest('hex').slice(0, 12)}';
const ASSETS = ${JSON.stringify(assets)};
const base = self.registration.scope;
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new URL(path, base).href))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('monster-workshop-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== new URL(base).origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') return cache.match(new URL('index.html', base).href);
    return fetch(event.request);
  }));
});
`,
);
console.log('Built Monster Workshop → dist/');
