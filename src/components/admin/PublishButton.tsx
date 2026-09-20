'use client'

import { useState } from 'react'

export function PublishButton({ pageId }: { pageId: string }) {
  const [publishing, setPublishing] = useState(false)

  return (
    <button
      type="button"
      disabled={publishing}
      onClick={async () => {
        setPublishing(true)
        await fetch(`/api/pages/${pageId}/publish`, { method: 'POST' })
        setPublishing(false)
      }}
      className="border px-4 py-2 text-sm"
    >
      {publishing ? 'Publishing…' : 'Publish'}
    </button>
  )
}
