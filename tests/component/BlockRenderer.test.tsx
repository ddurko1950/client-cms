// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockRenderer } from '@/components/site/BlockRenderer'

describe('BlockRenderer', () => {
  it('renders a hero, text, and button block', () => {
    render(
      <BlockRenderer
        blocks={[
          { type: 'hero', id: 'b1', headline: 'Welcome' },
          { type: 'text', id: 'b2', body: 'Some copy' },
          { type: 'button', id: 'b3', text: 'Click me', href: '/x', style: 'primary' },
        ]}
      />
    )

    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByText('Some copy')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Click me' })).toHaveAttribute('href', '/x')
  })

  it('strips a javascript: URI from a button href', () => {
    render(
      <BlockRenderer
        blocks={[{ type: 'button', id: 'b1', text: 'Click', href: 'javascript:alert(1)', style: 'primary' }]}
      />
    )
    // An <a> with no href has no implicit ARIA "link" role in jsdom, so we
    // locate it by text/tag rather than getByRole — that absence of an href
    // attribute is exactly what proves the javascript: URI was stripped.
    const link = screen.getByText('Click')
    expect(link.tagName).toBe('A')
    expect(link).not.toHaveAttribute('href')
  })
})
