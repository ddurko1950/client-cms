'use client'

import { useState } from 'react'
import type { Seo } from '@/lib/blocks/schema'

export function SeoPanel({
  bodyText,
  initialSeo,
  onChange,
}: {
  pageId: string
  initialSeo: Seo
  bodyText: string
  onChange?: (seo: Seo) => void
}) {
  const [seo, setSeo] = useState<Seo>(initialSeo)
  const [suggestion, setSuggestion] = useState<Seo | null>(null)

  function update(next: Seo) {
    setSeo(next)
    onChange?.(next)
  }

  async function requestSuggestion() {
    const res = await fetch('/api/seo-suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: seo.title ?? '', bodyText }),
    })
    setSuggestion(await res.json())
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
