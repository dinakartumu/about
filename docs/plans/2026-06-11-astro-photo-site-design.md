# Astro Personal Site with Photosets — Design

**Date:** 2026-06-11
**Status:** Validated

## Goal

Rebuild tumudinakar.com (currently a 2017 create-react-app) as a static Astro
site. Centerpiece: a photos section modeled on paulstamatiou.com/photos, fed by
Lightroom collections (e.g. the California collection set: Berkeley, Napa,
Point Reyes, …). Full rebuild: home, projects, about, photos.

## Decisions

| Decision | Choice |
|---|---|
| Scope | Full rebuild (home, projects, about, photos) |
| Photo flow | Lightroom export → import script → Cloudflare R2; JSON manifests in git |
| Site hosting | Cloudflare Pages (git push deploys) |
| Image serving | R2 custom domain + Cloudflare Image Transformations (`/cdn-cgi/image/...`) |
| Photo presentation | Large scrolling photos with muted per-photo EXIF line + lightbox |
| Content | Fresh draft copy; old 2017 content used as reference only |
| Visual direction | Dark, photo-forward, typography-led, minimal chrome |

## Architecture

Astro (latest, static output), no client framework. Vanilla JS only for the
lightbox. Old CRA code deleted (preserved in git history).

```
about/
├── astro.config.mjs
├── src/
│   ├── pages/
│   │   ├── index.astro          # home: intro + recent photoset teaser
│   │   ├── projects.astro
│   │   ├── about.astro
│   │   └── photos/
│   │       ├── index.astro      # photoset grid
│   │       └── [set].astro      # one page per photoset
│   ├── content/
│   │   └── photosets/           # one JSON manifest per set
│   ├── components/              # Nav, PhotoSetCard, Photo, Exif, Lightbox, Footer
│   └── styles/
├── scripts/
│   └── import-photos.mjs        # Lightroom export → R2 importer
└── docs/plans/
```

### Data model

One JSON manifest per photoset in `src/content/photosets/`, validated by an
Astro content collection schema:

```json
{
  "title": "Berkeley",
  "slug": "berkeley",
  "description": "",
  "cover": "berkeley/DSC04812",
  "date": "2026-05-10",
  "photos": [
    { "id": "berkeley/DSC04812", "width": 6000, "height": 4000,
      "exif": { "camera": "...", "lens": "...", "focal": "...",
                "aperture": "...", "shutter": "...", "iso": 400,
                "taken": "..." } }
  ]
}
```

All EXIF fields optional. Images live in R2 at `photos/<set>/<id>.jpg`; the
repo stores only manifests. All photoset pages are generated at build time.

## Photo pipeline

**Lightroom:** one export preset (full-res JPEG, quality 85, sRGB, metadata
included). Publish = export collection/picks to a folder.

**Import script:** `npm run import-photos -- ~/Exports/berkeley --title "Berkeley"`

1. Extract EXIF + pixel dimensions from each JPEG (`exifr` + `sharp`).
2. Upload originals to R2 via S3 API (credentials in `.env`, never committed).
   Skips already-uploaded files — incremental and re-runnable.
3. Write/update the manifest, sorted by capture time, first photo as default
   cover. Hand edits (title, description, cover, order, date) survive
   re-imports; the script only manages the photo list. `date` is set from the
   latest capture time at creation and is owner-editable thereafter.

Flags: `--dry-run` (show what would happen), `--prune` (remove manifest
entries for photos deleted from the export folder — explicit, never default).

**Serving:** R2 bucket exposed at `photos.<domain>`. Site requests sized
variants via `/cdn-cgi/image/width=N,format=auto/...` with srcsets at
480/800/1200/1600/2400w. Originals uploaded once; variants derived on the fly
and edge-cached, auto AVIF/WebP.

**One-time setup:** R2 bucket, API token, bucket custom domain, enable image
transformations on the zone.

## Pages & UI

- **Global:** near-black background (≈`#0c0c0d`), light gray text, one accent
  color, system font stack or single variable font. Minimal nav: name +
  Photos / Projects / About. Footer: copyright, built-with, source link.
- **Home `/`:** short intro (draft copy referencing pageloop.ai), social/email
  links, strip of 3–4 recent photosets from the manifests.
- **Photos index `/photos`:** responsive grid of photoset cards (cover, title,
  count, date), newest first. Covers wide-aspect-cropped via CDN for a uniform
  grid.
- **Photoset `/photos/[set]`:** title + description header; single-column
  large photos (landscape near full content width; adjacent portraits paired
  side-by-side). Native `loading="lazy"`, explicit width/height (no layout
  shift). Muted EXIF line under each photo:
  `X100V · 23mm · f/8 · 1/250 · ISO 320`. Click opens a vanilla-JS full-screen
  lightbox (2400w variant, arrows/swipe, Esc).
- **Projects / About:** simple typographic pages, content-collection backed
  project list (title, one-liner, link, year), draft copy to be rewritten.

## Deployment

Cloudflare Pages connected to GitHub; push to `master` deploys, branches get
previews. Domain → Pages; `photos.<domain>` → R2. No build-time secrets
(manifests are in the repo); R2 token is local-only.

## Edge cases

- **Missing EXIF:** line simply not rendered; schema fields optional.
- **Re-import:** diffs against manifest; uploads only new files; deletions
  require `--prune`.
- **Transform limits:** Cloudflare free tier ≈5,000 unique transforms/month;
  variants edge-cache, and overage degrades to originals, never broken images.

## Testing / verification

- Content collection schema validates every manifest at build time.
- Import script `--dry-run`.
- Lighthouse check on a photoset page.
- End-to-end first import with a small collection (La Mesa, 9 photos).
