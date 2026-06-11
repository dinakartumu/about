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
