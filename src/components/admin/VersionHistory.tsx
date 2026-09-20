'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface VersionItem {
  versionNumber: number
  publishedAt: string
}

export function VersionHistory({
  pageId,
  tenantId,
  versions,
}: {
  pageId: string
  tenantId: string
  versions: VersionItem[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function rollback(versionNumber: number) {
    setError(null)
    const res = await fetch(`/api/pages/${pageId}/rollback?tenantId=${tenantId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ versionNumber }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(typeof body?.error === 'string' ? body.error : 'Could not roll back to this version.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {versions.map((v) => (
          <li key={v.versionNumber} className="flex items-center justify-between border p-2">
            <span>
              Version {v.versionNumber} — {new Date(v.publishedAt).toLocaleString()}
            </span>
            <button type="button" onClick={() => rollback(v.versionNumber)} className="text-sm underline">
              Roll back
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
