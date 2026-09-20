import { z } from 'zod'

export const heroBlockSchema = z.object({
  type: z.literal('hero'),
  id: z.string(),
  headline: z.string().min(1).max(120),
  subhead: z.string().max(240).optional(),
  image: z.string().url().optional(),
  ctaText: z.string().max(40).optional(),
  ctaHref: z.string().max(300).optional(),
})

export const textBlockSchema = z.object({
  type: z.literal('text'),
  id: z.string(),
  body: z.string().min(1).max(5000),
})

export const imageTextBlockSchema = z.object({
  type: z.literal('imageText'),
  id: z.string(),
  image: z.string().url(),
  text: z.string().min(1).max(2000),
  imagePosition: z.enum(['left', 'right']),
})

export const buttonBlockSchema = z.object({
  type: z.literal('button'),
  id: z.string(),
  text: z.string().min(1).max(40),
  href: z.string().min(1).max(300),
  style: z.enum(['primary', 'secondary']),
})

export const galleryBlockSchema = z.object({
  type: z.literal('gallery'),
  id: z.string(),
  images: z.array(z.string().url()).min(1).max(20),
})

export const blockSchema = z.discriminatedUnion('type', [
  heroBlockSchema,
  textBlockSchema,
  imageTextBlockSchema,
  buttonBlockSchema,
  galleryBlockSchema,
])

export type Block = z.infer<typeof blockSchema>

export const seoSchema = z.object({
  title: z.string().max(60).optional(),
  description: z.string().max(160).optional(),
})

export type Seo = z.infer<typeof seoSchema>

export const pageContentSchema = z.object({
  blocks: z.array(blockSchema).max(50),
  seo: seoSchema,
})

export type PageContent = z.infer<typeof pageContentSchema>
