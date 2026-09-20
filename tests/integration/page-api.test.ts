import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

describe('page API', () => {
  it('creates and lists pages scoped to the caller tenant', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const tenant = await createTenant({ name: 'Acme', customDomain: 'acme.example.com' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: 'e@acme.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: createHandler } = await import('@/app/api/pages/route')
    const createReq = new Request('http://localhost/api/pages', {
      method: 'POST',
      body: JSON.stringify({ slug: 'about', title: 'About' }),
    })
    const createRes = await createHandler(createReq)
    expect(createRes.status).toBe(201)

    const { GET: listHandler } = await import('@/app/api/pages/route')
    const listRes = await listHandler()
    const { pages } = await listRes.json()
    expect(pages).toHaveLength(1)
    expect(pages[0].slug).toBe('about')
  })

  it('rejects draft saves that fail schema validation', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'Beta', customDomain: 'beta.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u2', email: 'e@beta.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: draftHandler } = await import('@/app/api/pages/[pageId]/draft/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ content: { blocks: [{ type: 'hero', id: 'b1', headline: '' }], seo: {} } }),
    })
    const res = await draftHandler(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(400)
  })

  it('returns 401 when there is no session', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(null as never)

    const { GET: listHandler } = await import('@/app/api/pages/route')
    const res = await listHandler()
    expect(res.status).toBe(401)
  })

  it('returns 404 when saving a draft for a nonexistent pageId', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { ObjectId } = await import('mongodb')
    const tenant = await createTenant({ name: 'Gamma', customDomain: 'gamma.example.com' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u3', email: 'e@gamma.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: draftHandler } = await import('@/app/api/pages/[pageId]/draft/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ content: { blocks: [], seo: {} } }),
    })
    const res = await draftHandler(req, { params: Promise.resolve({ pageId: new ObjectId().toString() }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for a malformed pageId', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const tenant = await createTenant({ name: 'Delta', customDomain: 'delta.example.com' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u4', email: 'e@delta.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: draftHandler } = await import('@/app/api/pages/[pageId]/draft/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ content: { blocks: [], seo: {} } }),
    })
    const res = await draftHandler(req, { params: Promise.resolve({ pageId: 'not-a-valid-id' }) })
    expect(res.status).toBe(400)
  })
})
