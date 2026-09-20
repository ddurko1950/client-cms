'use client'

import { useState } from 'react'
import { seoSchema, type Seo } from '@/lib/blocks/schema'

export function SeoPanel({
  bodyText,
  initialSeo,
  onChange,
}: {
  initialSeo: Seo
  bodyText: string
  onChange?: (seo: Seo) => void
}) {
  const [seo, setSeo] = useState<Seo>(initialSeo)
  const [suggestion, setSuggestion] = useState<Seo | null>(null)
  const [suggestError, setSuggestError] = useState<string | null>(null)

  function update(next: Seo) {
    setSeo(next)
    onChange?.(next)
  }

  async function requestSuggestion() {
    setSuggestError(null)
    const res = await fetch('/api/seo-suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: seo.title ?? '', bodyText }),
    })
    if (!res.ok) {
      setSuggestError('Could not generate a suggestion. Try again.')
      return
    }
    const body = await res.json()
    const parsed = seoSchema.safeParse(body)
    if (!parsed.success) {
      setSuggestError('Received an invalid suggestion.')
      return
    }
    setSuggestion(parsed.data)
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Meta title</span>
        <input
          aria-label="Meta title"
          value={seo.title ?? ''}
          onChange={(e) => update({ ...seo, title: e.target.value })}
          className="border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Meta description</span>
        <textarea
          aria-label="Meta description"
          value={seo.description ?? ''}
          onChange={(e) => update({ ...seo, description: e.target.value })}
          className="border p-2"
        />
      </label>

      <button type="button" onClick={requestSuggestion} className="self-start text-sm underline">
        Suggest with AI
      </button>
      {suggestError && <p className="text-sm text-red-600">{suggestError}</p>}

      {suggestion && (
        <div className="border p-2 text-sm">
          <p>{suggestion.title}</p>
          <p>{suggestion.description}</p>
          <button
            type="button"
            onClick={() => {
              update(suggestion)
              setSuggestion(null)
            }}
            className="mt-1 underline"
          >
            Accept suggestion
          </button>
        </div>
      )}
    </div>
  )
}
