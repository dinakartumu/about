@README.md

## Photos

- Originals live in R2 (`photos/<slug>/<name>.jpg`); the site never serves them directly. Every size is made on the fly by Cloudflare Image Resizing via `https://photos.dinakartumu.com/cdn-cgi/image/<options>/photos/...`.
- Cloudflare refuses to resize a source over **100 MP** (`Cf-Resized: err=9413`, 403) or **70 MB** (413). When that happens every size of the photo fails, not just the large ones. Panoramas are the usual culprit.
- `npm run import-photos` downscales anything over either limit to ~98 MP before upload (`scripts/lib/resize-limits.mjs`) and writes the uploaded dimensions to the manifest. Don't bypass it by uploading originals to R2 by hand.
- To debug a photo that won't load, request its `/cdn-cgi/image/...` URL with curl: the response body states the error. Check the original at `/photos/...` separately.
- After replacing an object in R2, the resizer can keep serving the old error for that URL until its cache expires. Appending `?v=2` to the request confirms whether the new file works.
