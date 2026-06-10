# tumudinakar.com

Personal site built with Astro. Photos served from Cloudflare R2.

- `npm run dev` — local dev server
- `npm run build` — production build to `dist/`
- `npm run test` — unit tests for the import script
- `npm run import-photos -- <folder> --title "Name"` — import a Lightroom export into a photoset (see `docs/plans/2026-06-11-astro-photo-site-design.md`)

## Gotchas

- Astro's content-layer cache lives in `node_modules/.astro` and survives manifest deletion/rename — deleted or renamed photoset manifests can keep showing up in builds. After deleting or renaming a manifest in `src/content/photosets/`, run `rm -rf node_modules/.astro` (or `npx astro sync --force`) before rebuilding. The same applies to CI build caches that persist `node_modules`.
