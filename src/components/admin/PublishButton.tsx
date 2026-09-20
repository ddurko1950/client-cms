'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function PublishButton({ pageId, tenantId }: { pageId: string; tenantId: string }) {
  const router = useRouter()
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function publish() {
    setPublishing(true)
    setError(null)
    try {
      const res = await fetch(`/api/pages/${pageId}/publish?tenantId=${tenantId}`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(typeof body?.error === 'string' ? body.error : 'Could not publish this page.')
        return
      }
      router.refresh()
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" disabled={publishing} onClick={publish} className="border px-4 py-2 text-sm">
        {publishing ? 'Publishing…' : 'Publish'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
