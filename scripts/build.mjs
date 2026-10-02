import { spawnSync } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('content', 'dist/content', { recursive: true });
console.log('Built Monster Workshop → dist/');
