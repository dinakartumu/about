#!/usr/bin/env node
/**
 * Generate the walk map for every photoset that has enough walking behind it.
 *
 * For each set: work out its city and the span of its photos, pull the Strava
 * walks that fall inside both, project them, fetch a Mapbox Static Images
 * basemap framed on exactly that projection, upload it to R2 beside the
 * photos, and write src/data/walk-maps/<slug>.json for the page to render.
 *
 *     npm run build-walk-maps -- [--dry-run] [--force] [slug ...]
 *
 * This runs by hand, not on every build. The walks are historical and the
 * basemap never changes, so the output is committed and the site build stays
 * offline — no Mapbox token reaches Cloudflare, and none reaches the browser.
 *
 * Activities come from rewind-cache/ (the same shards the activities pages
 * warm) so a regeneration costs no API calls. Re-run after `npm run cache:warm`
 * if a backfill changes history.
 */
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { buildWalkMap, tripWindow } from '../src/lib/walk-map.ts';
import { r2Client, uploadIfMissing } from './lib/r2.mjs';

const MANIFEST_DIR = 'src/content/photosets';
const OUT_DIR = 'src/data/walk-maps';
const CACHE_DIR = 'rewind-cache';
/**
 * One basemap per site theme. The page swaps them with a CSS media query
 * rather than hiding one in the DOM, so a visitor only ever downloads the one
 * they can see.
 */
const MAP_STYLES = { dark: 'mapbox/dark-v11', light: 'mapbox/light-v11' };

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
    /** Rewrite the JSON but leave the basemap alone — the frame rarely moves. */
    'skip-image': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
});

/** "la-mesa" -> "La Mesa". A set's own `city` wins when the slug lies. */
const cityForSlug = (slug) =>
  slug.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// --- every activity we have on disk, deduped -------------------------------
const activities = new Map();
if (existsSync(CACHE_DIR)) {
  for (const file of (await readdir(CACHE_DIR)).filter((f) => f.endsWith('.json'))) {
    const shard = JSON.parse(await readFile(path.join(CACHE_DIR, file), 'utf8'));
    for (const [key, body] of Object.entries(shard)) {
      if (!key.startsWith('/v1/running/activities')) continue;
      for (const a of body?.data ?? []) activities.set(a.strava_id ?? a.id, a);
    }
  }
}
const allActivities = [...activities.values()];
console.log(`${allActivities.length} activities in ${CACHE_DIR}/`);
if (!allActivities.length) {
  console.error(`No activities cached. Run \`npm run cache:warm\` first.`);
  process.exit(1);
}

const manifests = (await readdir(MANIFEST_DIR)).filter((f) => f.endsWith('.json'));
const wanted = positionals.length ? new Set(positionals) : null;

const built = [];
const skipped = [];

for (const file of manifests) {
  const set = JSON.parse(await readFile(path.join(MANIFEST_DIR, file), 'utf8'));
  if (wanted && !wanted.has(set.slug)) continue;

  // Where to look, and for what. A set naming a region (Goa) matches on state
  // so activity spread across its towns all counts; otherwise on city, which
  // defaults to the slug and can be overridden when Strava spells it its own
  // way (Dharamsala).
  const match = set.state
    ? { state: set.state, sports: set.sports }
    : { city: set.city ?? cityForSlug(set.slug), sports: set.sports };
  const place = match.state ?? match.city;
  // The window is the photos' own span — the walks that produced them.
  const window = tripWindow(set.photos.map((p) => p.exif?.taken).filter(Boolean));
  if (!window) {
    skipped.push([set.slug, 'no photo timestamps']);
    continue;
  }

  const map = buildWalkMap(allActivities, { ...match, ...window });
  if (!map) {
    skipped.push([set.slug, `not enough activity in ${place}`]);
    continue;
  }

  const record = {
    slug: set.slug,
    /** Display name. `city` is Strava's label and can differ — Dharamshala. */
    title: set.title,
    place,
    images: {},
    ...map,
    attribution: '© Mapbox © OpenStreetMap',
  };

  const summary = map.breakdown.map((t) => `${t.count} ${t.sport}`).join(', ');
  console.log(
    `${set.slug}: ${summary} — ${map.miles} mi over ${map.months} month${map.months === 1 ? '' : 's'} ` +
      `— zoom ${map.zoom} @ ${map.center.map((n) => n.toFixed(4)).join(',')}`
  );

  if (opts['dry-run']) {
    built.push(set.slug);
    continue;
  }

  const write = async () => {
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(path.join(OUT_DIR, `${set.slug}.json`), JSON.stringify(record, null, 2) + '\n');
  };

  if (opts['skip-image']) {
    // Carry the existing keys forward — they name bytes already in R2.
    const prev = path.join(OUT_DIR, `${set.slug}.json`);
    if (!existsSync(prev)) {
      console.error(`  no existing ${prev} to keep image keys from — run without --skip-image`);
      process.exit(1);
    }
    record.images = JSON.parse(await readFile(prev, 'utf8')).images;
    await write();
    console.log(`  ${Object.values(record.images).join(', ')} (left alone)`);
    built.push(set.slug);
    continue;
  }

  // --- basemaps: one Static Images call per theme, framed on our projection ---
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    console.error('Missing MAPBOX_TOKEN — add it to .env (a public pk.* token is fine).');
    process.exit(1);
  }
  const env = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  };
  const bucket = process.env.R2_BUCKET;
  if (!env.accountId || !env.accessKeyId || !env.secretAccessKey || !bucket) {
    console.error('Missing R2 config — set R2_* in .env');
    process.exit(1);
  }
  const client = r2Client(env);

  for (const [theme, style] of Object.entries(MAP_STYLES)) {
    const url =
      `https://api.mapbox.com/styles/v1/${style}/static/` +
      `${map.center[1]},${map.center[0]},${map.zoom},0/${map.width}x${map.height}@2x` +
      `?access_token=${token}&attribution=false&logo=false`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Mapbox ${res.status} for ${set.slug} (${theme}): ${(await res.text()).slice(0, 200)}`);
      process.exit(1);
    }
    const png = Buffer.from(await res.arrayBuffer());
    // Content-hashed key: regenerating a basemap writes a new object rather
    // than replacing one behind a CDN cache, so a stale image can never be
    // served and a negative cache on the old key can never poison the new one.
    const hash = createHash('sha256').update(png).digest('hex').slice(0, 8);
    const key = `maps/${set.slug}-${theme}-${hash}.png`;
    record.images[theme] = key;

    const result = await uploadIfMissing(client, bucket, key, png, {
      force: opts.force,
      contentType: 'image/png',
    });
    console.log(`  ${key} (${result}, ${(png.length / 1024).toFixed(0)} KB)`);
  }

  await write();
  built.push(set.slug);
}

console.log(`\nBuilt ${built.length}: ${built.join(', ') || '—'}`);
for (const [slug, why] of skipped) console.log(`  skipped ${slug} — ${why}`);
