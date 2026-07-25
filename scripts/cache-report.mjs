// Summarise the closed-year build cache after `npm run cache:warm`.
// Reads the shards directly rather than importing build-cache.ts so it stays a
// plain node script with no TypeScript step.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'rewind-cache');

if (!existsSync(dir)) {
  console.log('[cache] No rewind-cache/ directory — nothing was recorded.');
  process.exit(0);
}

const shards = readdirSync(dir)
  .filter((f) => /^\d{4}\.json$/.test(f))
  .sort();

let totalEntries = 0;
let totalBytes = 0;

console.log('[cache] Closed-year shards:');
for (const file of shards) {
  const raw = readFileSync(join(dir, file), 'utf-8');
  const entries = Object.keys(JSON.parse(raw)).length;
  const bytes = Buffer.byteLength(raw);
  totalEntries += entries;
  totalBytes += bytes;
  console.log(`  ${file.slice(0, 4)}  ${String(entries).padStart(4)} responses  ${(bytes / 1024).toFixed(0).padStart(5)} KB`);
}

console.log(
  `[cache] ${shards.length} years, ${totalEntries} responses, ${(totalBytes / 1024 / 1024).toFixed(2)} MB total`
);
console.log('[cache] Commit rewind-cache/ so Pages builds can use it.');
console.log('[cache] Re-run after any backfill — closed years are immutable only until you rewrite history.');
