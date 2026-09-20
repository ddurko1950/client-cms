'use client'

interface VersionItem {
  versionNumber: number
  publishedAt: string
}

export function VersionHistory({ pageId, versions }: { pageId: string; versions: VersionItem[] }) {
  async function rollback(versionNumber: number) {
    await fetch(`/api/pages/${pageId}/rollback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ versionNumber }),
    })
  }

  return (
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
  )
}
