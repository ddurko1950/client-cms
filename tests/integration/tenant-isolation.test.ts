import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

describe('tenant isolation', () => {
  it('an editor from tenant A cannot read a page belonging to tenant B', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenantA = await createTenant({ name: 'A', customDomain: 'a.example.com' })
    const tenantB = await createTenant({ name: 'B', customDomain: 'b.example.com' })
    const pageB = await createPage({ tenantId: tenantB._id, slug: 'secret', title: 'Secret' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: 'a@a.com', role: 'editor', tenantId: tenantA._id.toString() },
    } as never)

    const { GET } = await import('@/app/api/pages/[pageId]/route')
    const res = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ pageId: pageB._id.toString() }) })
    expect(res.status).toBe(404)
  })

  it('an editor cannot read another tenant\'s page by passing its tenantId as a query param', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenantA = await createTenant({ name: 'C', customDomain: 'c.example.com' })
    const tenantB = await createTenant({ name: 'D', customDomain: 'd.example.com' })
    const pageB = await createPage({ tenantId: tenantB._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u2', email: 'a@c.com', role: 'editor', tenantId: tenantA._id.toString() },
    } as never)

    const { GET } = await import('@/app/api/pages/[pageId]/route')
    const req = new NextRequest(`http://localhost?tenantId=${tenantB._id.toString()}`)
    const res = await GET(req, { params: Promise.resolve({ pageId: pageB._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('a superadmin can read pages across tenants by specifying tenantId', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'E', customDomain: 'e.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin', email: 'admin@x.com', role: 'superadmin', tenantId: null },
    } as never)

    const { GET } = await import('@/app/api/pages/[pageId]/route')
    const req = new NextRequest(`http://localhost?tenantId=${tenant._id.toString()}`)
    const res = await GET(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(200)
  })
})
