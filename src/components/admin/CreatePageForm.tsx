'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreatePageForm({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const res = await fetch(`/api/pages?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, title }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(typeof body?.error === 'string' ? body.error : 'Could not create the page.')
        return
      }
      const { page } = await res.json()
      router.push(`/admin/pages/${page._id}/edit?tenantId=${tenantId}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 border p-4">
      <h2 className="text-sm font-medium">New page</h2>
      <input
        aria-label="Slug"
        placeholder="Slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        className="border p-2"
        required
      />
      <input
        aria-label="Title"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border p-2"
        required
      />
      <button type="submit" disabled={creating} className="self-start bg-black px-4 py-2 text-white disabled:opacity-50">
        {creating ? 'Creating…' : 'Create page'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
