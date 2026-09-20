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
})
