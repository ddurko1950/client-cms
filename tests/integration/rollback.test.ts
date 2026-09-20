import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { NextRequest } from 'next/server'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

describe('versions and rollback API', () => {
  it('lists versions and rolls back to an earlier one', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'Acme', customDomain: 'acme.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'e@acme.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: publish } = await import('@/app/api/pages/[pageId]/publish/route')
    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'v1' } })
    await publish(new NextRequest('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ pageId: page._id.toString() }),
    })
    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'v2' } })
    await publish(new NextRequest('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ pageId: page._id.toString() }),
    })

    const { GET: listVersionsHandler } = await import('@/app/api/pages/[pageId]/versions/route')
    const listRes = await listVersionsHandler(new NextRequest('http://localhost'), {
      params: Promise.resolve({ pageId: page._id.toString() }),
    })
    const { versions } = await listRes.json()
    expect(versions).toHaveLength(2)

    const { POST: rollbackHandler } = await import('@/app/api/pages/[pageId]/rollback/route')
    const rollbackReq = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ versionNumber: 1 }),
    })
    const rollbackRes = await rollbackHandler(rollbackReq, {
      params: Promise.resolve({ pageId: page._id.toString() }),
    })
    const { page: rolledBack } = await rollbackRes.json()
    expect(rolledBack.published.seo.title).toBe('v1')
    expect(rolledBack.publishedVersion).toBe(3)
  })

  it('returns 400 for a malformed pageId on rollback', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const tenant = await createTenant({ name: 'Malformed', customDomain: 'malformed.example.com' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'e@malformed.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: rollbackHandler } = await import('@/app/api/pages/[pageId]/rollback/route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ versionNumber: 1 }),
    })
    const res = await rollbackHandler(req, { params: Promise.resolve({ pageId: 'not-a-valid-id' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when rolling back a nonexistent version number', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'NoVersion', customDomain: 'noversion.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'e@noversion.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: rollbackHandler } = await import('@/app/api/pages/[pageId]/rollback/route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ versionNumber: 99 }),
    })
    const res = await rollbackHandler(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for a malformed JSON body on rollback', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'BadJson', customDomain: 'badjson.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'e@badjson.com', role: 'editor', tenantId: tenant._id.toString() },
    } as never)

    const { POST: rollbackHandler } = await import('@/app/api/pages/[pageId]/rollback/route')
    const req = new NextRequest('http://localhost', { method: 'POST', body: 'not json at all' })
    const res = await rollbackHandler(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid request body' })
  })

  it('lets a superadmin list versions and roll back by supplying tenantId', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'Super', customDomain: 'super.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })
    const query = `?tenantId=${tenant._id.toString()}`

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'admin@x.com', role: 'superadmin', tenantId: null },
    } as never)

    const { POST: publish } = await import('@/app/api/pages/[pageId]/publish/route')
    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'v1' } })
    await publish(new NextRequest(`http://localhost${query}`, { method: 'POST' }), {
      params: Promise.resolve({ pageId: page._id.toString() }),
    })
    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'v2' } })
    await publish(new NextRequest(`http://localhost${query}`, { method: 'POST' }), {
      params: Promise.resolve({ pageId: page._id.toString() }),
    })

    const { GET: listVersionsHandler } = await import('@/app/api/pages/[pageId]/versions/route')
    const listRes = await listVersionsHandler(new NextRequest(`http://localhost${query}`), {
      params: Promise.resolve({ pageId: page._id.toString() }),
    })
    expect(listRes.status).toBe(200)
    const { versions } = await listRes.json()
    expect(versions).toHaveLength(2)

    const { POST: rollbackHandler } = await import('@/app/api/pages/[pageId]/rollback/route')
    const rollbackRes = await rollbackHandler(
      new NextRequest(`http://localhost${query}`, { method: 'POST', body: JSON.stringify({ versionNumber: 1 }) }),
      { params: Promise.resolve({ pageId: page._id.toString() }) }
    )
    expect(rollbackRes.status).toBe(200)
    const { page: rolledBack } = await rollbackRes.json()
    expect(rolledBack.published.seo.title).toBe('v1')
    expect(rolledBack.publishedVersion).toBe(3)
  })

  it('rejects a superadmin rollback that omits tenantId', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage } = await import('@/lib/models/page')
    const tenant = await createTenant({ name: 'SuperNoTid', customDomain: 'supernotid.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    vi.mocked(auth).mockResolvedValue({
      user: { id: new ObjectId().toString(), email: 'admin@x.com', role: 'superadmin', tenantId: null },
    } as never)

    const { POST: rollbackHandler } = await import('@/app/api/pages/[pageId]/rollback/route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ versionNumber: 1 }),
    })
    const res = await rollbackHandler(req, { params: Promise.resolve({ pageId: page._id.toString() }) })
    expect(res.status).toBe(400)
  })
})
