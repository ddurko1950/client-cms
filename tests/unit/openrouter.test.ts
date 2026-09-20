// tests/unit/openrouter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: JSON.stringify({ title: 'Great SEO Title', description: 'A concise, compelling description.' }) } },
        ],
      }),
    })
  )
  process.env.OPENROUTER_API_KEY = 'test-key'
})

describe('suggestSeo', () => {
  it('parses the model response into title/description', async () => {
    const { suggestSeo } = await import('@/lib/openrouter')
    const result = await suggestSeo({ title: 'About us', bodyText: 'We build things.' })
    expect(result).toEqual({ title: 'Great SEO Title', description: 'A concise, compelling description.' })
  })

  it('throws a descriptive error when the response is not valid JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Sure, here you go: {title: oops}' } }] }),
    } as never)

    const { suggestSeo } = await import('@/lib/openrouter')
    await expect(suggestSeo({ title: 'About us', bodyText: 'We build things.' })).rejects.toThrow(
      'OpenRouter response was not valid JSON'
    )
  })

  it('throws a descriptive error when the parsed response is missing title/description', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'Only a title' }) } }] }),
    } as never)

    const { suggestSeo } = await import('@/lib/openrouter')
    await expect(suggestSeo({ title: 'About us', bodyText: 'We build things.' })).rejects.toThrow(
      'OpenRouter response did not include a title and description string'
    )
  })
})
