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
