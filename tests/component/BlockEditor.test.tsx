// tests/component/BlockEditor.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BlockEditor } from '@/components/admin/BlockEditor'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ page: {} }) })
  )
})

describe('BlockEditor', () => {
  it('adds a text block and edits its content', () => {
    render(<BlockEditor pageId="p1" initialBlocks={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /add text block/i }))
    const textarea = screen.getByLabelText(/body/i)
    fireEvent.change(textarea, { target: { value: 'Hello world' } })

    expect(textarea).toHaveValue('Hello world')
  })

  it('removes a block', () => {
    render(<BlockEditor pageId="p1" initialBlocks={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /add text block/i }))
    expect(screen.getByLabelText(/body/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /remove block/i }))
    expect(screen.queryByLabelText(/body/i)).not.toBeInTheDocument()
  })

  it('saves the draft via the API on "Save draft"', async () => {
    render(<BlockEditor pageId="p1" initialBlocks={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/pages/p1/draft',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
