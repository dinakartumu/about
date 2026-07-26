/**
 * Reading an Arc Timeline Editor backup off disk.
 *
 * The backup is bucketed two different ways: timeline items by calendar month
 * (`items/2024-08.json`) and GPS samples by ISO week, gzipped
 * (`samples/2024-W31.json.gz`). A set's window has to be mapped onto both, and
 * ISO weeks drift against the calendar — 2024-12-30 lives in 2025-W01 — so the
 * keys are walked day by day rather than derived arithmetically.
 *
 * Only the files a window actually touches are read. The whole backup is 8.1M
 * samples; a three-day trip needs two of the weekly files.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

const DAY_MS = 86_400_000;

/** "2024-08" for the month a timestamp falls in, UTC. */
export function monthKey(date) {
  return new Date(date).toISOString().slice(0, 7);
}

/**
 * "2024-W31" for the ISO week a timestamp falls in.
 *
 * ISO weeks start on Monday and belong to whichever year holds their Thursday,
 * which is why the year here is read off the shifted date rather than the
 * original — the last days of December often belong to the next year's W01.
 */
export function isoWeekKey(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  // Shift to the Thursday of this week: Sunday counts as 7, not 0.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Every month and ISO week key a window touches, in order. */
export function windowKeys(from, to) {
  const months = new Set();
  const weeks = new Set();
  const end = new Date(to).getTime();
  // A day either side, so a walk that began before midnight UTC is not missed.
  for (let t = new Date(from).getTime() - DAY_MS; t <= end + DAY_MS; t += DAY_MS) {
    months.add(monthKey(t));
    weeks.add(isoWeekKey(t));
  }
  months.add(monthKey(end));
  weeks.add(isoWeekKey(end));
  return { months: [...months], weeks: [...weeks] };
}

/**
 * The items and samples covering a window. Missing buckets are simply absent —
 * a backup need not span every month a photoset does.
 */
export async function readArcWindow(dir, { from, to }) {
  const { months, weeks } = windowKeys(from, to);

  const items = [];
  for (const m of months) {
    const file = path.join(dir, 'items', `${m}.json`);
    if (!existsSync(file)) continue;
    items.push(...JSON.parse(await readFile(file, 'utf8')));
  }

  const samples = [];
  for (const w of weeks) {
    const file = path.join(dir, 'samples', `${w}.json.gz`);
    if (!existsSync(file)) continue;
    samples.push(...JSON.parse(gunzipSync(await readFile(file)).toString('utf8')));
  }

  return { items, samples, months, weeks };
}
