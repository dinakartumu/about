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
    /**
     * City as Strava labels it, when the slug doesn't match. Only used to find
     * the set's walks — Dharamshala is "Dharamsala" there, and a slug-derived
     * guess silently finds nothing. Several may be given: Strava files a San
     * Francisco trip under its neighbourhoods, and `state` there is the whole
     * of California.
     */
    city: z.union([z.string(), z.array(z.string().min(1)).min(1)]).optional(),
    /**
     * Strava state, for a set named after a region rather than a town — Goa's
     * activity is spread across Mapusa, Calangute and Panjim. Wins over `city`.
     */
    state: z.string().optional(),
    /**
     * Sport types to draw, or 'all'. Defaults to walking: most sets were
     * photographed on foot, but Goa was ridden.
     */
    sports: z.union([z.literal('all'), z.array(z.string().min(1))]).optional(),
    /**
     * Optional headings over consecutive runs of `photos`, in order. Omit for
     * an unbroken set. Counts are advisory — see layOutSections in
     * src/lib/photo-layout.ts for how over/under-runs are handled.
     */
    sections: z
      .array(
        z.object({
          title: z.string().min(1),
          count: z.number().int().positive(),
        })
      )
      .optional(),
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
