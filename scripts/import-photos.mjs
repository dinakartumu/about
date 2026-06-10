#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import sharp from 'sharp';
import exifr from 'exifr';
import { mergeManifest } from './lib/manifest.mjs';
import { toPhotoExif } from './lib/exif-format.mjs';
import { r2Client, uploadIfMissing } from './lib/r2.mjs';

const MANIFEST_DIR = 'src/content/photosets';
const EXIF_FIELDS = ['Model', 'LensModel', 'FocalLength', 'FNumber', 'ExposureTime', 'ISO', 'DateTimeOriginal'];

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    title: { type: 'string' },
    slug: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    prune: { type: 'boolean', default: false },
  },
});

const folder = positionals[0];
if (!folder || !existsSync(folder)) {
  console.error('Usage: npm run import-photos -- <folder> --title "Name" [--slug name] [--dry-run] [--prune]');
  process.exit(1);
}

const slug = opts.slug ?? path.basename(folder).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const manifestPath = path.join(MANIFEST_DIR, `${slug}.json`);
const existing = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : null;

if (!existing && !opts.title) {
  console.error('New photoset: --title is required.');
  process.exit(1);
}

// 1. Scan the export folder
const files = (await readdir(folder))
  .filter((f) => /\.jpe?g$/i.test(f))
  .sort();
if (files.length === 0) {
  console.error(`No JPEGs found in ${folder}`);
  process.exit(1);
}

console.log(`Scanning ${files.length} photos in ${folder} …`);
const scanned = [];
for (const file of files) {
  const filePath = path.join(folder, file);
  const meta = await sharp(filePath).metadata();
  const swap = (meta.orientation ?? 1) >= 5; // EXIF rotated 90°/270°
  const raw = await exifr.parse(filePath, EXIF_FIELDS).catch(() => null);
  scanned.push({
    id: `${slug}/${path.parse(file).name}`,
    width: swap ? meta.height : meta.width,
    height: swap ? meta.width : meta.height,
    exif: toPhotoExif(raw),
    _file: filePath,
  });
}

// Ids derive from basenames — fail loudly on collisions (e.g. DSC001.jpg + DSC001.jpeg)
const dupes = [...new Set(scanned.map((p) => p.id).filter((id, i, ids) => ids.indexOf(id) !== i))];
if (dupes.length) {
  console.error(`Duplicate photo ids in folder: ${dupes.join(', ')}`);
  process.exit(1);
}

// 2. Merge into manifest
const merged = mergeManifest(
  existing,
  scanned.map(({ _file, ...p }) => p),
  { prune: opts.prune }
);
if (!existing) {
  merged.title = opts.title;
  merged.slug = slug;
} else if (opts.title) {
  merged.title = opts.title;
}

const newIds = new Set(merged.photos.map((p) => p.id));
const toUpload = scanned.filter((p) => newIds.has(p.id));

if (opts['dry-run']) {
  console.log(`[dry-run] would upload up to ${toUpload.length} photos to R2 (existing objects are skipped)`);
  console.log(`[dry-run] would write ${manifestPath}:`);
  console.log(JSON.stringify({ ...merged, photos: `${merged.photos.length} photos` }, null, 2));
  process.exit(0);
}

// 3. Upload to R2 (skips objects that already exist)
const env = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
};
const bucket = process.env.R2_BUCKET;
if (!env.accountId || !env.accessKeyId || !env.secretAccessKey || !bucket) {
  console.error('Missing R2 config — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET in .env');
  process.exit(1);
}
const client = r2Client(env);
let uploaded = 0;
for (const p of toUpload) {
  const key = `photos/${p.id}.jpg`;
  const result = await uploadIfMissing(client, bucket, key, await readFile(p._file));
  if (result === 'uploaded') uploaded += 1;
  process.stdout.write(`\r${key} (${result})        `);
}
console.log(`\nUploaded ${uploaded} new, skipped ${toUpload.length - uploaded} existing.`);

// 4. Write manifest
await mkdir(MANIFEST_DIR, { recursive: true });
await writeFile(manifestPath, JSON.stringify(merged, null, 2) + '\n');
console.log(`Wrote ${manifestPath} (${merged.photos.length} photos)`);
