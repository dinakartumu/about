import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// An llms.txt (https://llmstxt.org) index of the site, linked from the
// homepage with rel="describedby". Photosets come from the collection so new
// ones show up without editing this file.
export const GET: APIRoute = async ({ site }) => {
  const url = (path: string) => new URL(path, site).href;
  const sets = (await getCollection('photosets')).sort((a, b) =>
    b.data.date.localeCompare(a.data.date)
  );

  const body = `# Dinakar Tumu

> Engineer and photographer. Founding engineer at Pageloop, building an AI agent
> that keeps help-center articles up to date. Writing code since 2012.

## About
- [About](${url('/about/')}): background, work history (Pageloop, Liscio, Wooter) and education
- [Projects](${url('/projects/')}): things I've built
- [PhotoDrift](${url('/photodrift/')}): a macOS menu bar app that shuffles your desktop wallpaper from Apple Photos and Adobe Lightroom

## Photos
- [All photosets](${url('/photos/')})
${sets.map(({ data }) => `- [${data.title}](${url(`/photos/${data.slug}/`)})`).join('\n')}

## Logs
- [Activities](${url('/activities/')}): recent activities with distance, pace and a monthly chart
- [Listening](${url('/listening/')}): top artists, albums and tracks by year
- [Movies](${url('/movies/')}): recently watched films with ratings
- [Places](${url('/places/')}): recent check-ins with top categories, cities and venues

## Optional
- [Sitemap](${url('/sitemap.xml')}): every page on the site
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
