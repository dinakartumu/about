# Astro Personal Site with Photosets — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 2017 create-react-app site with a static Astro site featuring R2-backed photoset galleries (design: `docs/plans/2026-06-11-astro-photo-site-design.md`).

**Architecture:** Static Astro 5 site, no client framework (vanilla JS lightbox only). Photos live in Cloudflare R2; the repo stores only JSON manifests (one per photoset) validated by an Astro content collection. A Node import script extracts EXIF, uploads to R2, and writes manifests. Cloudflare Image Transformations serve responsive variants.

**Tech Stack:** Astro 5, TypeScript (strict), Vitest, exifr, sharp, @aws-sdk/client-s3, Cloudflare Pages + R2.

**Notes for the implementer:**
- Run all commands from the repo root: `/Users/dinakartumu/Development/about`.
- Tasks 6 and 12 require the human partner (Cloudflare dashboard + Lightroom export). Everything else is autonomous.
- TDD applies to the script logic (Tasks 3–4). For `.astro` pages, `npm run build` is the verification (the content collection schema validates manifests at build time).

---

### Task 1: Remove old site, scaffold Astro

**Files:**
- Delete: `src/` (entire old CRA source), `public/index.html`, `README.md` content, `node_modules/`
- Create: `package.json` (replace), `astro.config.mjs`, `tsconfig.json`, `.gitignore` (replace), `src/pages/index.astro`, `README.md` (replace)

**Step 1: Delete the old CRA code**

```bash
rm -rf node_modules src public README.md package.json .gitignore
mkdir -p src/pages public
```

**Step 2: Write `package.json`**

```json
{
  "name": "tumudinakar",
  "type": "module",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "import-photos": "node scripts/import-photos.mjs"
  },
  "dependencies": {
    "astro": "^5.0.0"
  },
  "devDependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "dotenv": "^16.4.0",
    "exifr": "^7.1.3",
    "sharp": "^0.33.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 3: Write `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tumudinakar.com',
});
```

**Step 4: Write `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

**Step 5: Write `.gitignore`**

```
node_modules/
dist/
.astro/
.env
.DS_Store
```

**Step 6: Write a placeholder `src/pages/index.astro`**

```astro
---
---
<html lang="en">
  <head><meta charset="utf-8" /><title>Dinakar Tumu</title></head>
  <body><h1>Dinakar Tumu</h1></body>
</html>
```

**Step 7: Write `README.md`**

```markdown
# tumudinakar.com

Personal site built with Astro. Photos served from Cloudflare R2.

- `npm run dev` — local dev server
- `npm run build` — production build to `dist/`
- `npm run test` — unit tests for the import script
- `npm run import-photos -- <folder> --title "Name"` — import a Lightroom export into a photoset (see `docs/plans/2026-06-11-astro-photo-site-design.md`)
```

**Step 8: Install and verify the build**

```bash
npm install
npm run build
```

Expected: `npm run build` finishes with `Complete!` and a `dist/index.html` exists. (sharp is a native dependency — if install fails on it, run `npm install --include=optional sharp`.)

**Step 9: Remove stale .DS_Store files from git and commit**

```bash
git rm -r --cached --ignore-unmatch .DS_Store src/.DS_Store
git add -A
git commit -m "feat: replace CRA with Astro scaffold"
```

---

### Task 2: Base layout, dark theme, Nav, Footer

**Files:**
- Create: `src/styles/global.css`, `src/layouts/Layout.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`
- Modify: `src/pages/index.astro`

**Step 1: Write `src/styles/global.css`**

```css
:root {
  --bg: #0c0c0d;
  --surface: #161618;
  --text: #d4d4d8;
  --muted: #8a8a93;
  --accent: #d9a553;
  --content-width: 72rem;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-size: 1rem;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

a { color: var(--text); text-decoration: none; }
a:hover { color: var(--accent); }

h1, h2, h3 { line-height: 1.2; font-weight: 600; color: #fff; }

img { display: block; max-width: 100%; height: auto; }

.container {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: 0 1.25rem;
}

.muted { color: var(--muted); }
```

**Step 2: Write `src/components/Nav.astro`**

```astro
---
const links = [
  { href: '/photos', label: 'Photos' },
  { href: '/projects', label: 'Projects' },
  { href: '/about', label: 'About' },
];
const current = Astro.url.pathname;
---
<header class="container">
  <nav>
    <a href="/" class="name">Dinakar Tumu</a>
    <ul>
      {links.map(({ href, label }) => (
        <li>
          <a href={href} aria-current={current.startsWith(href) ? 'page' : undefined}>{label}</a>
        </li>
      ))}
    </ul>
  </nav>
</header>

<style>
  nav {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 1.5rem 0;
  }
  .name { font-weight: 600; color: #fff; }
  ul { display: flex; gap: 1.5rem; list-style: none; margin: 0; padding: 0; }
  a { color: var(--muted); }
  a[aria-current='page'], a:hover { color: #fff; }
</style>
```

**Step 3: Write `src/components/Footer.astro`**

```astro
---
const year = new Date().getFullYear();
---
<footer class="container">
  <p class="muted">© {year} Dinakar Tumu · Built with Astro</p>
</footer>

<style>
  footer { padding: 3rem 1.25rem; }
  p { font-size: 0.85rem; }
</style>
```

**Step 4: Write `src/layouts/Layout.astro`**

```astro
---
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
}
const { title, description = 'Dinakar Tumu — engineer and photographer.' } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <title>{title}</title>
  </head>
  <body>
    <Nav />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

**Step 4b: Write `public/favicon.svg`** (simple monogram on the site's dark background)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0c0c0d"/>
  <text x="16" y="22" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#d9a553">dt</text>
</svg>
```

**Step 5: Rewrite `src/pages/index.astro` to use the layout**

```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout title="Dinakar Tumu">
  <section class="container">
    <h1>Dinakar Tumu</h1>
    <p class="muted">Engineer at Pageloop. Photographer around the Bay Area.</p>
  </section>
</Layout>
```

**Step 6: Verify**

```bash
npm run build
```

Expected: build succeeds. Optionally `npm run dev` and check http://localhost:4321 renders dark page with nav and footer.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: dark base layout with nav and footer"
```

---

### Task 3: Manifest merge logic (TDD)

The core of the import script: pure function that creates/updates a photoset manifest. No I/O — fully unit-testable.

**Files:**
- Test: `scripts/lib/manifest.test.mjs`
- Create: `scripts/lib/manifest.mjs`

**Step 1: Write the failing tests**

`scripts/lib/manifest.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { mergeManifest } from './manifest.mjs';

const photo = (id, taken, extra = {}) => ({
  id,
  width: 6000,
  height: 4000,
  exif: { taken },
  ...extra,
});

describe('mergeManifest', () => {
  it('creates a new manifest sorted by capture time', () => {
    const scanned = [photo('la-mesa/b', '2026-05-02T10:00:00'), photo('la-mesa/a', '2026-05-01T10:00:00')];
    const m = mergeManifest(null, scanned);
    expect(m.photos.map((p) => p.id)).toEqual(['la-mesa/a', 'la-mesa/b']);
    expect(m.cover).toBe('la-mesa/a');
    expect(m.date).toBe('2026-05-02');
  });

  it('preserves existing order, metadata, and cover on re-import', () => {
    const existing = {
      title: 'La Mesa', slug: 'la-mesa', description: 'Spring', cover: 'la-mesa/b',
      date: '2026-05-02',
      photos: [photo('la-mesa/b', '2026-05-02T10:00:00'), photo('la-mesa/a', '2026-05-01T10:00:00')],
    };
    const scanned = [photo('la-mesa/a', '2026-05-01T10:00:00'), photo('la-mesa/b', '2026-05-02T10:00:00')];
    const m = mergeManifest(existing, scanned);
    expect(m.title).toBe('La Mesa');
    expect(m.description).toBe('Spring');
    expect(m.cover).toBe('la-mesa/b');
    expect(m.photos.map((p) => p.id)).toEqual(['la-mesa/b', 'la-mesa/a']);
  });

  it('appends new photos at the end, sorted by capture time', () => {
    const existing = {
      title: 'La Mesa', slug: 'la-mesa', description: '', cover: 'la-mesa/a', date: '2026-05-01',
      photos: [photo('la-mesa/a', '2026-05-01T10:00:00')],
    };
    const scanned = [
      photo('la-mesa/c', '2026-05-03T10:00:00'),
      photo('la-mesa/a', '2026-05-01T10:00:00'),
      photo('la-mesa/b', '2026-05-02T10:00:00'),
    ];
    const m = mergeManifest(existing, scanned);
    expect(m.photos.map((p) => p.id)).toEqual(['la-mesa/a', 'la-mesa/b', 'la-mesa/c']);
  });

  it('updates dimensions/exif of existing photos from the new scan', () => {
    const existing = {
      title: 'X', slug: 'x', description: '', cover: 'x/a', date: '2026-05-01',
      photos: [photo('x/a', '2026-05-01T10:00:00', { width: 100, height: 100 })],
    };
    const scanned = [photo('x/a', '2026-05-01T10:00:00')];
    const m = mergeManifest(existing, scanned);
    expect(m.photos[0].width).toBe(6000);
  });

  it('keeps photos missing from the scan unless prune is set', () => {
    const existing = {
      title: 'X', slug: 'x', description: '', cover: 'x/gone', date: '2026-05-01',
      photos: [photo('x/gone', '2026-05-01T10:00:00'), photo('x/kept', '2026-05-02T10:00:00')],
    };
    const scanned = [photo('x/kept', '2026-05-02T10:00:00')];
    expect(mergeManifest(existing, scanned).photos).toHaveLength(2);
    const pruned = mergeManifest(existing, scanned, { prune: true });
    expect(pruned.photos.map((p) => p.id)).toEqual(['x/kept']);
    expect(pruned.cover).toBe('x/kept'); // cover reset when pruned away
  });

  it('handles photos with no capture time (sorted last, by id)', () => {
    const scanned = [photo('x/b', undefined), photo('x/a', '2026-05-01T10:00:00')];
    const m = mergeManifest(null, scanned);
    expect(m.photos[0].id).toBe('x/a');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm run test
```

Expected: FAIL — `Cannot find module './manifest.mjs'`.

**Step 3: Write `scripts/lib/manifest.mjs`**

```js
const byCapture = (a, b) =>
  (a.exif?.taken ?? '9999').localeCompare(b.exif?.taken ?? '9999') || a.id.localeCompare(b.id);

function latestDate(photos) {
  const taken = photos.map((p) => p.exif?.taken).filter(Boolean).sort();
  return taken.length ? taken[taken.length - 1].slice(0, 10) : new Date().toISOString().slice(0, 10);
}

/**
 * Merge a fresh folder scan into an existing manifest (or create one).
 * Preserves hand-edited title/description/cover/order; only manages the photo list.
 */
export function mergeManifest(existing, scanned, { prune = false } = {}) {
  const sorted = [...scanned].sort(byCapture);

  if (!existing) {
    return {
      title: '',
      slug: '',
      description: '',
      cover: sorted[0]?.id ?? '',
      date: latestDate(sorted),
      photos: sorted,
    };
  }

  const scannedById = new Map(sorted.map((p) => [p.id, p]));
  const kept = existing.photos
    .filter((p) => !prune || scannedById.has(p.id))
    .map((p) => scannedById.get(p.id) ?? p);
  const keptIds = new Set(kept.map((p) => p.id));
  const added = sorted.filter((p) => !keptIds.has(p.id));

  const manifest = { ...existing, photos: [...kept, ...added] };
  if (!manifest.photos.some((p) => p.id === manifest.cover)) {
    manifest.cover = manifest.photos[0]?.id ?? '';
  }
  return manifest;
}
```

**Step 4: Run tests to verify they pass**

```bash
npm run test
```

Expected: all 6 tests PASS.

**Step 5: Commit**

```bash
git add scripts/lib/manifest.mjs scripts/lib/manifest.test.mjs
git commit -m "feat: manifest merge logic for photo imports"
```

---

### Task 4: EXIF formatting helpers (TDD)

Convert raw EXIF values into the display strings stored in manifests (`f/8`, `1/250`, `23mm`).

**Files:**
- Test: `scripts/lib/exif-format.test.mjs`
- Create: `scripts/lib/exif-format.mjs`

**Step 1: Write the failing tests**

`scripts/lib/exif-format.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { toPhotoExif } from './exif-format.mjs';

describe('toPhotoExif', () => {
  it('formats a full EXIF record', () => {
    const exif = toPhotoExif({
      Model: 'X100V',
      LensModel: 'XF23mmF2',
      FocalLength: 23,
      FNumber: 8,
      ExposureTime: 0.004,
      ISO: 320,
      DateTimeOriginal: new Date('2026-05-01T10:30:00Z'),
    });
    expect(exif).toEqual({
      camera: 'X100V',
      lens: 'XF23mmF2',
      focal: '23mm',
      aperture: 'f/8',
      shutter: '1/250',
      iso: 320,
      taken: '2026-05-01T10:30:00.000Z',
    });
  });

  it('formats slow shutter speeds in seconds', () => {
    expect(toPhotoExif({ ExposureTime: 2.5 }).shutter).toBe('2.5s');
    expect(toPhotoExif({ ExposureTime: 1 }).shutter).toBe('1s');
  });

  it('formats sub-second exposures of 0.4s and up as decimal seconds', () => {
    expect(toPhotoExif({ ExposureTime: 0.6 }).shutter).toBe('0.6s');
    expect(toPhotoExif({ ExposureTime: 0.8 }).shutter).toBe('0.8s');
  });

  it('formats fast exposures as reciprocal fractions', () => {
    expect(toPhotoExif({ ExposureTime: 0.3333 }).shutter).toBe('1/3');
    expect(toPhotoExif({ ExposureTime: 0.004 }).shutter).toBe('1/250');
  });

  it('keeps fractional apertures', () => {
    expect(toPhotoExif({ FNumber: 2.8 }).aperture).toBe('f/2.8');
  });

  it('rounds apertures to one decimal to absorb APEX float noise', () => {
    expect(toPhotoExif({ FNumber: 1.7999999523162842 }).aperture).toBe('f/1.8');
  });

  it('rounds focal lengths', () => {
    expect(toPhotoExif({ FocalLength: 23.3 }).focal).toBe('23mm');
  });

  it('omits taken for malformed DateTimeOriginal without throwing', () => {
    const exif = toPhotoExif({
      Model: 'X100V',
      ISO: 320,
      DateTimeOriginal: '2026:05:01 10:30:00',
    });
    expect(exif).toEqual({ camera: 'X100V', iso: 320 });
  });

  it('falls back to Make for camera when Model is missing', () => {
    expect(toPhotoExif({ Make: 'FUJIFILM' }).camera).toBe('FUJIFILM');
  });

  it('omits missing fields entirely', () => {
    expect(toPhotoExif({})).toEqual({});
    expect(toPhotoExif(null)).toEqual({});
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm run test
```

Expected: FAIL — `Cannot find module './exif-format.mjs'`.

**Step 3: Write `scripts/lib/exif-format.mjs`**

```js
export function formatShutter(t) {
  if (t >= 0.4) return `${Number(t)}s`;
  return `1/${Math.round(1 / t)}`;
}

/** Map raw exifr output to the manifest's exif shape. Missing fields are omitted. */
export function toPhotoExif(raw) {
  if (!raw) return {};
  const exif = {};
  if (raw.Model) exif.camera = raw.Model;
  else if (raw.Make) exif.camera = raw.Make;
  if (raw.LensModel) exif.lens = raw.LensModel;
  if (raw.FocalLength) exif.focal = `${Math.round(raw.FocalLength)}mm`;
  if (raw.FNumber) exif.aperture = `f/${Math.round(raw.FNumber * 10) / 10}`;
  if (raw.ExposureTime) exif.shutter = formatShutter(raw.ExposureTime);
  if (raw.ISO) exif.iso = raw.ISO;
  if (raw.DateTimeOriginal) {
    const d = new Date(raw.DateTimeOriginal);
    if (Number.isFinite(d.getTime())) exif.taken = d.toISOString();
  }
  return exif;
}
```

**Step 4: Run tests to verify they pass**

```bash
npm run test
```

Expected: all tests PASS (manifest + exif suites).

**Step 5: Commit**

```bash
git add scripts/lib/exif-format.mjs scripts/lib/exif-format.test.mjs
git commit -m "feat: EXIF formatting for photo manifests"
```

---

### Task 5: Import script CLI

Wires folder scan + EXIF + merge + R2 upload. R2 upload is isolated in a small module; the CLI supports `--dry-run` so it can be verified before Cloudflare exists.

**Files:**
- Create: `scripts/lib/r2.mjs`, `scripts/import-photos.mjs`, `.env.example`

**Step 1: Write `scripts/lib/r2.mjs`**

```js
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

export function r2Client({ accountId, accessKeyId, secretAccessKey }) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/** Upload body to bucket/key unless it already exists. Returns 'uploaded' or 'skipped'. */
export async function uploadIfMissing(client, bucket, key, body) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return 'skipped';
  } catch (err) {
    if (err.$metadata?.httpStatusCode !== 404 && err.name !== 'NotFound') throw err;
  }
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'image/jpeg' })
  );
  return 'uploaded';
}
```

**Step 2: Write `scripts/import-photos.mjs`**

```js
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
```

**Step 3: Write `.env.example`**

```
# Cloudflare R2 credentials for scripts/import-photos.mjs (copy to .env, never commit .env)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=photos
```

**Step 4: Verify with a dry run on synthetic data**

```bash
mkdir -p /tmp/import-test
# create a tiny real JPEG with sharp
node -e "import('sharp').then(({default:s}) => s({create:{width:40,height:30,channels:3,background:'#333'}}).jpeg().toFile('/tmp/import-test/IMG_0001.jpg'))"
npm run import-photos -- /tmp/import-test --title "Test" --dry-run
```

Expected output: `Scanning 1 photos…`, then `[dry-run] would upload up to 1 photos` and a manifest preview with `"title": "Test"`, `"slug": "import-test"`, width 40 / height 30. No manifest file is written (`ls src/content/photosets` → no such directory). Clean up: `rm -rf /tmp/import-test`.

**Step 5: Run the full test suite**

```bash
npm run test
```

Expected: PASS (no regressions).

**Step 6: Commit**

```bash
git add scripts/ .env.example
git commit -m "feat: Lightroom-to-R2 photo import script"
```

---

### Task 6: Cloudflare R2 setup + first real import (NEEDS HUMAN PARTNER)

**Files:**
- Create: `.env` (local only, gitignored), `src/content/photosets/la-mesa.json` (generated)

**Step 1: Walk the human partner through Cloudflare dashboard setup**

Present these steps and wait for confirmation:

1. **Create bucket:** Cloudflare dashboard → R2 Object Storage → Create bucket → name `photos`, location Automatic.
2. **API token:** R2 → Manage API tokens → Create API token → permission "Object Read & Write", scope it to the `photos` bucket → copy the Access Key ID, Secret Access Key, and the Account ID shown on the R2 overview page.
3. **Public access (pick one):**
   - *Domain already on Cloudflare:* bucket → Settings → Custom Domains → add `photos.<domain>`.
   - *No domain on Cloudflare yet:* bucket → Settings → enable the `r2.dev` public URL (works immediately, but no image transformations — the site has a flag for this).
4. **Image transformations (only if custom domain):** dashboard → Images → Transformations → enable for the zone.

**Step 2: Create `.env` from the partner's credentials**

```bash
cp .env.example .env
# fill in R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY; R2_BUCKET=photos
```

**Step 3: Have the partner export the La Mesa collection (9 photos) from Lightroom**

Lightroom export settings: JPEG, quality 85, color space sRGB, no resize, metadata "All". Export to e.g. `~/Exports/la-mesa/`.

**Step 4: Dry-run, then real import**

```bash
npm run import-photos -- ~/Exports/la-mesa --title "La Mesa" --dry-run
npm run import-photos -- ~/Exports/la-mesa --title "La Mesa"
```

Expected: `Uploaded 9 new, skipped 0 existing.` and `Wrote src/content/photosets/la-mesa.json (9 photos)`.

**Step 5: Verify idempotency — re-run and confirm skips**

```bash
npm run import-photos -- ~/Exports/la-mesa
```

Expected: `Uploaded 0 new, skipped 9 existing.`

**Step 6: Verify one image is publicly reachable**

```bash
curl -sI "https://<public-base>/photos/la-mesa/<first-id>.jpg" | head -3
```

Expected: `HTTP/2 200`, `content-type: image/jpeg`. (`<public-base>` is the custom domain or `<bucket>.r2.dev` URL from Step 1.)

**Step 7: Commit**

```bash
git add src/content/photosets/la-mesa.json
git commit -m "feat: first photoset manifest (La Mesa)"
```

---

### Task 7: Content collection schema + image URL helpers

**Files:**
- Create: `src/content.config.ts`, `src/lib/config.ts`, `src/lib/images.ts`

**Step 1: Write `src/lib/config.ts`** (fill in the real base URL from Task 6)

```ts
/** Public base URL for photos (R2 custom domain or r2.dev URL), no trailing slash. */
export const PHOTOS_BASE = 'https://photos.tumudinakar.com';

/** Cloudflare Image Transformations available? false when serving from r2.dev. */
export const TRANSFORMS_ENABLED = true;
```

**Step 2: Write `src/lib/images.ts`**

```ts
import { PHOTOS_BASE, TRANSFORMS_ENABLED } from './config';

interface TransformOpts {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'scale-down';
}

/** URL for a photo by manifest id (e.g. "la-mesa/DSC04812"), optionally resized. */
export function photoUrl(id: string, opts: TransformOpts = {}): string {
  const path = `photos/${id}.jpg`;
  if (!TRANSFORMS_ENABLED || (!opts.width && !opts.height)) {
    return `${PHOTOS_BASE}/${path}`;
  }
  const params = Object.entries({ ...opts, quality: 82, format: 'auto' })
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return `${PHOTOS_BASE}/cdn-cgi/image/${params}/${path}`;
}

export const PHOTO_WIDTHS = [480, 800, 1200, 1600, 2400];

export function photoSrcset(id: string): string {
  if (!TRANSFORMS_ENABLED) return '';
  return PHOTO_WIDTHS.map((w) => `${photoUrl(id, { width: w })} ${w}w`).join(', ');
}
```

**Step 3: Write `src/content.config.ts`**

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const photosets = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/photosets' }),
  schema: z.object({
    title: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().default(''),
    cover: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    photos: z
      .array(
        z.object({
          id: z.string(),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
          exif: z
            .object({
              camera: z.string(),
              lens: z.string(),
              focal: z.string(),
              aperture: z.string(),
              shutter: z.string(),
              iso: z.number(),
              taken: z.string(),
            })
            .partial()
            .optional(),
        })
      )
      .min(1),
  }),
});

export const collections = { photosets };
```

**Step 4: Verify the schema validates the real manifest**

```bash
npm run build
```

Expected: build succeeds. To confirm validation actually runs, temporarily break it: edit `la-mesa.json`, change `"title": "La Mesa"` to `"title": ""`, run `npm run build` → expect a content collection validation ERROR mentioning `title`. Revert the change (`git checkout src/content/photosets/la-mesa.json`) and confirm `npm run build` passes again.

**Step 5: Commit**

```bash
git add src/content.config.ts src/lib/
git commit -m "feat: photoset content collection schema and image URL helpers"
```

---

### Task 8: Photos index page

**Files:**
- Create: `src/components/PhotoSetCard.astro`, `src/pages/photos/index.astro`

**Step 1: Write `src/components/PhotoSetCard.astro`**

```astro
---
import { photoUrl } from '../lib/images';

interface Props {
  slug: string;
  title: string;
  cover: string;
  count: number;
  date: string;
}
const { slug, title, cover, count, date } = Astro.props;
const year = date.slice(0, 4);
---
<a class="card" href={`/photos/${slug}`}>
  <img
    src={photoUrl(cover, { width: 800, height: 500, fit: 'cover' })}
    alt={title}
    width="800"
    height="500"
    loading="lazy"
  />
  <div class="meta">
    <span class="title">{title}</span>
    <span class="muted">{count} photos · {year}</span>
  </div>
</a>

<style>
  .card { display: block; }
  img {
    width: 100%;
    aspect-ratio: 8 / 5;
    object-fit: cover;
    border-radius: 6px;
    background: var(--surface);
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0.5rem 0.1rem;
    font-size: 0.9rem;
  }
  .title { color: #fff; font-weight: 500; }
  .card:hover img { opacity: 0.85; }
</style>
```

**Step 2: Write `src/pages/photos/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import Layout from '../../layouts/Layout.astro';
import PhotoSetCard from '../../components/PhotoSetCard.astro';

const sets = (await getCollection('photosets')).sort((a, b) =>
  b.data.date.localeCompare(a.data.date)
);
---
<Layout title="Photos · Dinakar Tumu" description="Photosets by Dinakar Tumu.">
  <section class="container">
    <h1>Photos</h1>
    <div class="grid">
      {sets.map(({ data }) => (
        <PhotoSetCard
          slug={data.slug}
          title={data.title}
          cover={data.cover}
          count={data.photos.length}
          date={data.date}
        />
      ))}
    </div>
  </section>
</Layout>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
    gap: 1.5rem 1.25rem;
    margin: 2rem 0;
  }
</style>
```

**Step 3: Verify**

```bash
npm run build && npm run preview
```

Open http://localhost:4321/photos — expect a grid with one La Mesa card whose cover image loads from R2. (If `TRANSFORMS_ENABLED` is false, the full-size original loads — fine for now.)

**Step 4: Commit**

```bash
git add src/components/PhotoSetCard.astro src/pages/photos/
git commit -m "feat: photos index with photoset grid"
```

---

### Task 9: Photoset detail page

**Files:**
- Create: `src/components/Exif.astro`, `src/components/Photo.astro`, `src/pages/photos/[set].astro`

**Step 1: Write `src/components/Exif.astro`**

```astro
---
interface Props {
  exif?: {
    camera?: string;
    lens?: string;
    focal?: string;
    aperture?: string;
    shutter?: string;
    iso?: number;
  };
}
const { exif } = Astro.props;
const parts = exif
  ? [exif.camera, exif.focal, exif.aperture, exif.shutter, exif.iso && `ISO ${exif.iso}`].filter(Boolean)
  : [];
---
{parts.length > 0 && <p class="exif muted">{parts.join(' · ')}</p>}

<style>
  .exif {
    font-size: 0.78rem;
    margin: 0.4rem 0 0;
    letter-spacing: 0.01em;
  }
</style>
```

**Step 2: Write `src/components/Photo.astro`**

```astro
---
import { photoUrl, photoSrcset } from '../lib/images';
import Exif from './Exif.astro';

interface Props {
  photo: {
    id: string;
    width: number;
    height: number;
    exif?: Record<string, any>;
  };
  index: number;
  sizes?: string;
}
const { photo, index, sizes = '(max-width: 76rem) 100vw, 72rem' } = Astro.props;
const srcset = photoSrcset(photo.id);
---
<figure>
  <a
    class="photo-link"
    href={photoUrl(photo.id, { width: 2400 })}
    data-index={index}
    aria-label={`View photo ${index + 1} full screen`}
  >
    <img
      src={photoUrl(photo.id, { width: 1200 })}
      srcset={srcset || undefined}
      sizes={srcset ? sizes : undefined}
      width={photo.width}
      height={photo.height}
      alt=""
      loading={index < 2 ? 'eager' : 'lazy'}
      decoding="async"
    />
  </a>
  <Exif exif={photo.exif} />
</figure>

<style>
  figure { margin: 0; }
  img { width: 100%; border-radius: 4px; background: var(--surface); }
</style>
```

**Step 3: Write `src/pages/photos/[set].astro`**

Portrait pairing: adjacent portrait photos render side-by-side; everything else full width.

```astro
---
import { getCollection } from 'astro:content';
import Layout from '../../layouts/Layout.astro';
import Photo from '../../components/Photo.astro';
import { photoUrl } from '../../lib/images';

export async function getStaticPaths() {
  const sets = await getCollection('photosets');
  return sets.map((set) => ({ params: { set: set.data.slug }, props: { set } }));
}

const { set } = Astro.props;
const { title, description, photos } = set.data;

// Group adjacent portraits into pairs; landscapes stand alone.
type P = (typeof photos)[number];
const isPortrait = (p: P) => p.height > p.width;
const rows: { photos: { photo: P; index: number }[] }[] = [];
for (let i = 0; i < photos.length; i++) {
  if (isPortrait(photos[i]) && i + 1 < photos.length && isPortrait(photos[i + 1])) {
    rows.push({ photos: [{ photo: photos[i], index: i }, { photo: photos[i + 1], index: i + 1 }] });
    i++;
  } else {
    rows.push({ photos: [{ photo: photos[i], index: i }] });
  }
}
const lightboxUrls = photos.map((p) => photoUrl(p.id, { width: 2400 }));
---
<Layout title={`${title} · Photos · Dinakar Tumu`} description={description || `${title} photoset.`}>
  <article class="container">
    <header>
      <h1>{title}</h1>
      {description && <p class="muted">{description}</p>}
      <p class="muted count">{photos.length} photos</p>
    </header>

    <div class="photos">
      {rows.map((row) => (
        <div class={`row ${row.photos.length === 2 ? 'pair' : ''}`}>
          {row.photos.map(({ photo, index }) => (
            <Photo
              photo={photo}
              index={index}
              sizes={row.photos.length === 2 ? '(max-width: 76rem) 50vw, 36rem' : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  </article>

  <dialog id="lightbox">
    <button class="close" aria-label="Close">×</button>
    <button class="prev" aria-label="Previous photo">‹</button>
    <img alt="" />
    <button class="next" aria-label="Next photo">›</button>
  </dialog>
</Layout>

<script type="application/json" id="lightbox-data" set:html={JSON.stringify(lightboxUrls)} />
<script>
  // Note: data passed via JSON script tag, NOT define:vars — astro 5.x has an open
  // XSS advisory in define:vars sanitization (GHSA-j687-52p2-xcff).
  const lightboxUrls = JSON.parse(
    document.getElementById('lightbox-data')!.textContent!
  ) as string[];
  const dialog = document.getElementById('lightbox') as HTMLDialogElement;
  const img = dialog.querySelector('img');
  let current = 0;

  function show(i) {
    current = (i + lightboxUrls.length) % lightboxUrls.length;
    img.src = lightboxUrls[current];
  }

  document.querySelectorAll('.photo-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      show(Number(link.dataset.index));
      dialog.showModal();
    });
  });

  dialog.querySelector('.close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.prev').addEventListener('click', () => show(current - 1));
  dialog.querySelector('.next').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });

  let touchX = null;
  dialog.addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX), { passive: true });
  dialog.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) show(dx < 0 ? current + 1 : current - 1);
    touchX = null;
  });
</script>

<style>
  header { margin: 1rem 0 2rem; }
  .count { font-size: 0.85rem; }
  .photos { display: flex; flex-direction: column; gap: 2.5rem; padding-bottom: 2rem; }
  .row.pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    align-items: start;
  }
  @media (max-width: 40rem) {
    .row.pair { grid-template-columns: 1fr; gap: 2.5rem; }
  }

  dialog {
    border: 0;
    padding: 0;
    background: transparent;
    max-width: 100vw;
    max-height: 100vh;
    width: 100vw;
    height: 100vh;
  }
  dialog::backdrop { background: rgba(0, 0, 0, 0.95); }
  dialog img {
    max-width: 95vw;
    max-height: 95vh;
    width: auto;
    height: auto;
    margin: auto;
    position: absolute;
    inset: 0;
    object-fit: contain;
  }
  dialog button {
    position: fixed;
    z-index: 1;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    border: 0;
    font-size: 1.6rem;
    line-height: 1;
    padding: 0.5rem 0.9rem;
    border-radius: 4px;
    cursor: pointer;
  }
  .close { top: 1rem; right: 1rem; }
  .prev { left: 1rem; top: 50%; transform: translateY(-50%); }
  .next { right: 1rem; top: 50%; transform: translateY(-50%); }
</style>
```

**Step 4: Verify**

```bash
npm run build && npm run preview
```

Open http://localhost:4321/photos/la-mesa and check: photos render in order with no layout shift while loading (width/height set); portrait pairs sit side-by-side; EXIF line appears under photos that have metadata; clicking a photo opens the lightbox; arrows/Esc/swipe work; click outside closes.

**Step 5: Commit**

```bash
git add src/components/Exif.astro src/components/Photo.astro 'src/pages/photos/[set].astro'
git commit -m "feat: photoset page with EXIF, portrait pairing, and lightbox"
```

---

### Task 10: Home, About, Projects pages

**Files:**
- Create: `src/data/projects.json`, `src/pages/about.astro`, `src/pages/projects.astro`
- Modify: `src/pages/index.astro`

**Step 1: Write `src/data/projects.json`** (draft content — partner rewrites later)

```json
[
  {
    "title": "Pageloop",
    "blurb": "TODO: one-liner about what you build at Pageloop.",
    "href": "https://pageloop.ai",
    "year": "2026"
  },
  {
    "title": "This site",
    "blurb": "Astro, Cloudflare R2 photosets imported straight from Lightroom.",
    "href": "https://github.com/dinakartumu/about",
    "year": "2026"
  }
]
```

**Step 2: Rewrite `src/pages/index.astro`** (intro + recent photosets strip)

```astro
---
import { getCollection } from 'astro:content';
import Layout from '../layouts/Layout.astro';
import PhotoSetCard from '../components/PhotoSetCard.astro';

const recent = (await getCollection('photosets'))
  .sort((a, b) => b.data.date.localeCompare(a.data.date))
  .slice(0, 4);
---
<Layout title="Dinakar Tumu">
  <section class="container intro">
    <h1>Dinakar Tumu</h1>
    <p>
      <!-- DRAFT COPY — rewrite me -->
      Engineer at <a href="https://pageloop.ai">Pageloop</a>. I spend my weekends
      photographing the Bay Area — most of what I shoot ends up in
      <a href="/photos">photosets</a>.
    </p>
    <p class="muted">
      <a href="mailto:dinakar@pageloop.ai">Email</a> · <a href="https://github.com/dinakartumu">GitHub</a>
    </p>
  </section>

  {recent.length > 0 && (
    <section class="container">
      <h2>Recent photos</h2>
      <div class="grid">
        {recent.map(({ data }) => (
          <PhotoSetCard
            slug={data.slug}
            title={data.title}
            cover={data.cover}
            count={data.photos.length}
            date={data.date}
          />
        ))}
      </div>
    </section>
  )}
</Layout>

<style>
  .intro { padding: 3rem 1.25rem 2rem; max-width: 44rem; margin: 0; }
  .intro h1 { font-size: 2rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 1rem; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: 1.5rem 1.25rem;
    margin-bottom: 2rem;
  }
</style>
```

**Step 3: Write `src/pages/about.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout title="About · Dinakar Tumu">
  <section class="container prose">
    <h1>About</h1>
    <!-- DRAFT COPY — rewrite me -->
    <p>
      I'm Dinakar, an engineer based in the Bay Area, currently building at
      <a href="https://pageloop.ai">Pageloop</a>.
    </p>
    <p>
      Outside of work I photograph California — small towns, coastlines, and the
      hills around Berkeley. Everything on this site was shot on my own time and
      published straight from my Lightroom collections.
    </p>
    <p class="muted">Reach me at <a href="mailto:dinakar@pageloop.ai">dinakar@pageloop.ai</a>.</p>
  </section>
</Layout>

<style>
  .prose { max-width: 44rem; margin: 0; padding-top: 2rem; padding-bottom: 2rem; }
  .prose a { text-decoration: underline; text-underline-offset: 3px; }
</style>
```

**Step 4: Write `src/pages/projects.astro`**

```astro
---
import Layout from '../layouts/Layout.astro';
import projects from '../data/projects.json';
---
<Layout title="Projects · Dinakar Tumu">
  <section class="container">
    <h1>Projects</h1>
    <ul>
      {projects.map((p) => (
        <li>
          <div>
            <a href={p.href} class="title">{p.title}</a>
            <p class="muted blurb">{p.blurb}</p>
          </div>
          <span class="muted">{p.year}</span>
        </li>
      ))}
    </ul>
  </section>
</Layout>

<style>
  section { max-width: 44rem; margin: 0; padding-top: 2rem; }
  ul { list-style: none; padding: 0; margin: 2rem 0; display: flex; flex-direction: column; gap: 1.5rem; }
  li { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; }
  .title { color: #fff; font-weight: 500; text-decoration: underline; text-underline-offset: 3px; }
  .blurb { margin: 0.2rem 0 0; font-size: 0.9rem; }
</style>
```

**Step 5: Verify**

```bash
npm run build && npm run preview
```

Check `/`, `/about`, `/projects` all render; home shows the La Mesa card; nav highlights the current section.

**Step 6: Commit**

```bash
git add src/data/ src/pages/
git commit -m "feat: home, about, and projects pages with draft copy"
```

---

### Task 11: Code review + polish pass

**Step 1: Request code review**

Use superpowers:requesting-code-review against this plan and the design doc. Address findings.

**Step 2: Run everything**

```bash
npm run test && npm run build
```

Expected: tests pass, build succeeds.

**Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: address code review findings"
```

---

### Task 12: Deploy to Cloudflare Pages (NEEDS HUMAN PARTNER)

**Step 1: Push the branch and merge to master** (per partner's preference — see superpowers:finishing-a-development-branch)

**Step 2: Walk the partner through Pages setup**

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → select the `about` repo.
2. Build settings: framework preset **Astro**, build command `npm run build`, output directory `dist`. No environment variables needed.
3. Deploy, confirm the `*.pages.dev` URL renders.
4. Custom domain: Pages project → Custom domains → add the apex domain (and confirm `photos.<domain>` from Task 6 still serves images).
5. If the site was on the `r2.dev` URL until now: add the bucket custom domain, enable Images → Transformations, then flip `TRANSFORMS_ENABLED` to `true` and update `PHOTOS_BASE` in `src/lib/config.ts`, commit, push.

**Step 3: Verify production**

- Open `/photos/la-mesa` on the production URL; confirm images load and `<img srcset>` requests hit `/cdn-cgi/image/...` variants (check the network tab — sizes ≪ original bytes).
- Run a Lighthouse audit on the photoset page (Chrome DevTools). Expect ≥90 on Performance/Accessibility/Best Practices; no layout-shift complaints.

**Step 4: Import the rest of the photosets**

The partner exports remaining curated collections (Berkeley, Napa, Point Reyes, …) and runs `npm run import-photos -- <folder> --title "Name"` per set, committing each manifest. The site rebuilds automatically on push.
