// tests/component/SeoPanel.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SeoPanel } from '@/components/admin/SeoPanel'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ title: 'Suggested Title', description: 'Suggested description.' }) })
  )
})

describe('SeoPanel', () => {
  it('fetches a suggestion and only applies it once accepted', async () => {
    render(<SeoPanel initialSeo={{}} bodyText="Some page copy" />)

    fireEvent.click(screen.getByRole('button', { name: /suggest with ai/i }))

    await waitFor(() => expect(screen.getByText('Suggested Title')).toBeInTheDocument())
    expect(screen.getByLabelText(/meta title/i)).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: /accept suggestion/i }))
    expect(screen.getByLabelText(/meta title/i)).toHaveValue('Suggested Title')
  })
})
