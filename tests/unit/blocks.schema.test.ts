import { describe, it, expect } from 'vitest'
import { blockSchema, pageContentSchema } from '@/lib/blocks/schema'

describe('blockSchema', () => {
  it('accepts a valid hero block', () => {
    const result = blockSchema.safeParse({
      type: 'hero',
      id: 'b1',
      headline: 'Welcome',
      subhead: 'We do things',
      image: 'https://example.com/hero.jpg',
      ctaText: 'Learn more',
      ctaHref: '/about',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a hero block with no headline', () => {
    const result = blockSchema.safeParse({ type: 'hero', id: 'b1', headline: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown block type', () => {
    const result = blockSchema.safeParse({ type: 'script', id: 'b1', code: 'alert(1)' })
    expect(result.success).toBe(false)
  })

  it('accepts a valid gallery block and rejects an empty one', () => {
    expect(
      blockSchema.safeParse({ type: 'gallery', id: 'g1', images: ['https://example.com/1.jpg'] }).success
    ).toBe(true)
    expect(blockSchema.safeParse({ type: 'gallery', id: 'g1', images: [] }).success).toBe(false)
  })
})

describe('pageContentSchema', () => {
  it('enforces SEO field length limits', () => {
    const tooLong = { blocks: [], seo: { title: 'x'.repeat(61), description: 'ok' } }
    expect(pageContentSchema.safeParse(tooLong).success).toBe(false)

    const ok = { blocks: [], seo: { title: 'Short title', description: 'Short description' } }
    expect(pageContentSchema.safeParse(ok).success).toBe(true)
  })
})
