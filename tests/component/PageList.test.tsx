// tests/component/PageList.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageList } from '@/components/admin/PageList'

describe('PageList', () => {
  it('renders each page title and slug with an edit link', () => {
    render(
      <PageList
        pages={[
          { _id: 'p1', slug: 'home', title: 'Home', publishedVersion: 2 },
          { _id: 'p2', slug: 'about', title: 'About', publishedVersion: null },
        ]}
      />
    )

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('/home')).toBeInTheDocument()
    expect(screen.getByText('Unpublished')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /edit/i })).toHaveLength(2)
  })
})
