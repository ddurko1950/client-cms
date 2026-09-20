import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { NextRequest } from 'next/server'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

describe('publish API', () => {
  it('publishes a valid draft and creates a version snapshot', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'Acme', customDomain: 'acme.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })
    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'Acme Home' } })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'e@acme.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST } = await import('@/app/api/pages/[pageId]/publish/route')
    const req = new NextRequest('http://localhost', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(200)

    const { page: published } = await res.json()
    expect(published.published.seo.title).toBe('Acme Home')
    expect(published.publishedVersion).toBe(1)
  })

  it('rejects publishing when the current draft fails validation', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'Beta', customDomain: 'beta.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })
    // Force an invalid draft directly (bypassing the draft API's own validation)
    // to prove publish re-validates rather than trusting stored data.
    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'x'.repeat(61) } })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'e@beta.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST } = await import('@/app/api/pages/[pageId]/publish/route')
    const req = new NextRequest('http://localhost', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(400)
  })

  it('lets a superadmin publish by supplying the target tenantId as a query param', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'Super', customDomain: 'super.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })
    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'Super Home' } })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'admin@x.com', role: 'superadmin', tenantId: null },
    } as never)

    const { POST } = await import('@/app/api/pages/[pageId]/publish/route')
    const req = new NextRequest(`http://localhost?tenantId=${tenant._id.toString()}`, { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(200)

    const { page: published } = await res.json()
    expect(published.published.seo.title).toBe('Super Home')
    expect(published.publishedVersion).toBe(1)
  })

  it('rejects a superadmin publish that omits tenantId', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'NoTenantId', customDomain: 'notenantid.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'admin@x.com', role: 'superadmin', tenantId: null },
    } as never)

    const { POST } = await import('@/app/api/pages/[pageId]/publish/route')
    const req = new NextRequest('http://localhost', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(400)
  })
})
