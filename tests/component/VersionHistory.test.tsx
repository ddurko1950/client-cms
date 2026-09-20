// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VersionHistory } from '@/components/admin/VersionHistory'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ page: {} }) }))
})

describe('VersionHistory', () => {
  it('lists versions and rolls back on click', async () => {
    render(
      <VersionHistory
        pageId="p1"
        tenantId="t1"
        versions={[
          { versionNumber: 1, publishedAt: '2026-01-01T00:00:00.000Z' },
          { versionNumber: 2, publishedAt: '2026-02-01T00:00:00.000Z' },
        ]}
      />
    )

    expect(screen.getByText(/version 1/i)).toBeInTheDocument()
    expect(screen.getByText(/version 2/i)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /roll back/i })[0])

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/pages/p1/rollback?tenantId=t1',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ versionNumber: 1 }) })
      )
    })
  })
})
