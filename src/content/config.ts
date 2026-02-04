// src/content/config.ts
import { z, defineCollection } from "astro:content";

const youtubeId = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{11}$/, "YouTube video ID must be 11 characters (letters, numbers, _ or -).");

const films = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    year: z.number().int(),
    role: z.string().optional(),
    format: z.string().optional(),
    camera: z.string().optional(),
    featured: z.boolean().default(false),

    // ID-only, validated
    youtubeId: youtubeId.optional(),

    // R2 media library stores these as URL strings
    poster: z.string(),
    stills: z.array(z.string()).optional(),

    logline: z.string().optional(),
    synopsis: z.string().optional(),
    credits: z.array(z.string()).optional(),
    awards: z.array(z.string()).optional(),
  }),
});

const photos = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    year: z.number().int().optional(),
    featured: z.boolean().default(false),

    cover: z.string(),
    images: z.array(z.string()),

    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }),
});

const pages = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    kicker: z.string().optional(),
    headline: z.string().optional(),
    bio: z.string().optional(),
    headshot: z.string().optional(),
    socials: z.array(z.object({
      label: z.string(),
      href: z.string(),
      icon: z.string(),
    })).optional(),
    capabilities: z.array(z.string()).optional(),
  }),
});

const site = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
    poster: z.string().optional(),
  }),
});

export const collections = { films, photos, pages, site };
