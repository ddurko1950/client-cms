import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('next/headers', () => ({ draftMode: vi.fn().mockResolvedValue({ isEnabled: false }) }))

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

  it('an editor from tenant A cannot roll back a page belonging to tenant B', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft, publishPage } = await import('@/lib/models/page')
    const { ObjectId } = await import('mongodb')
    const tenantA = await createTenant({ name: 'F', customDomain: 'f.example.com' })
    const tenantB = await createTenant({ name: 'G', customDomain: 'g.example.com' })
    const pageB = await createPage({ tenantId: tenantB._id, slug: 'home', title: 'Home' })

    // Give tenant B's page a real version 1 so a successful rollback would be possible.
    await saveDraft(tenantB._id, pageB._id, { blocks: [], seo: { title: 'B v1' } })
    await publishPage(tenantB._id, pageB._id, new ObjectId())

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u3', email: 'a@f.com', role: 'editor', tenantId: tenantA._id.toString() },
    } as never)

    const { POST: rollbackHandler } = await import('@/app/api/pages/[pageId]/rollback/route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ versionNumber: 1 }),
    })
    const res = await rollbackHandler(req, { params: Promise.resolve({ pageId: pageB._id.toString() }) })
    expect(res.status).toBe(404)

    // And tenant B's page is untouched.
    const { getPage } = await import('@/lib/models/page')
    const after = await getPage(tenantB._id, pageB._id)
    expect(after?.publishedVersion).toBe(1)
  })

  it('an editor from tenant A sees no version data for a page belonging to tenant B', async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft, publishPage } = await import('@/lib/models/page')
    const { ObjectId } = await import('mongodb')
    const tenantA = await createTenant({ name: 'H', customDomain: 'h.example.com' })
    const tenantB = await createTenant({ name: 'I', customDomain: 'i.example.com' })
    const pageB = await createPage({ tenantId: tenantB._id, slug: 'home', title: 'Home' })

    await saveDraft(tenantB._id, pageB._id, { blocks: [], seo: { title: 'tenant-b-secret' } })
    await publishPage(tenantB._id, pageB._id, new ObjectId())

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u4', email: 'a@h.com', role: 'editor', tenantId: tenantA._id.toString() },
    } as never)

    const { GET: listVersionsHandler } = await import('@/app/api/pages/[pageId]/versions/route')
    const res = await listVersionsHandler(new NextRequest('http://localhost'), {
      params: Promise.resolve({ pageId: pageB._id.toString() }),
    })

    const body = await res.json()
    expect(body.versions).toEqual([])
    expect(JSON.stringify(body)).not.toContain('tenant-b-secret')
  })
})

describe('Draft Mode cross-tenant IDOR regression', () => {
  it("shows tenant B's published content, never its draft, to a tenant A editor with Draft Mode on", async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft, publishPage } = await import('@/lib/models/page')
    const { ObjectId } = await import('mongodb')
    const { draftMode } = await import('next/headers')

    const tenantA = await createTenant({ name: 'J', customDomain: 'j.example.com' })
    const tenantB = await createTenant({ name: 'K', customDomain: 'k.example.com' })
    const pageB = await createPage({ tenantId: tenantB._id, slug: 'home', title: 'Home' })

    // Tenant B: published content, then a *different* unpublished draft.
    await saveDraft(tenantB._id, pageB._id, {
      blocks: [{ type: 'text', id: 'b1', body: 'B PUBLISHED CONTENT' }],
      seo: { title: 'B published' },
    })
    await publishPage(tenantB._id, pageB._id, new ObjectId())
    await saveDraft(tenantB._id, pageB._id, {
      blocks: [{ type: 'text', id: 'b2', body: 'B SECRET DRAFT CONTENT' }],
      seo: { title: 'B secret draft' },
    })

    // Draft Mode is globally enabled for this request...
    vi.mocked(draftMode).mockResolvedValue({ isEnabled: true } as never)
    // ...but the caller is an editor for tenant A, not tenant B.
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u5', email: 'a@j.com', role: 'editor', tenantId: tenantA._id.toString() },
    } as never)

    const { default: TenantSitePage, generateMetadata } = await import('@/app/_sites/[tenantId]/[slug]/page')
    const params = Promise.resolve({ tenantId: tenantB._id.toString(), slug: 'home' })
    const rendered = JSON.stringify(await TenantSitePage({ params }))

    expect(rendered).toContain('B PUBLISHED CONTENT')
    expect(rendered).not.toContain('B SECRET DRAFT CONTENT')

    const meta = await generateMetadata({ params: Promise.resolve({ tenantId: tenantB._id.toString(), slug: 'home' }) })
    expect(meta.title).toBe('B published')
    expect(meta.title).not.toBe('B secret draft')
  })

  it("shows tenant B's own editor the draft when Draft Mode is on (the check is scoped, not a blanket block)", async () => {
    const { auth } = await import('@/lib/auth')
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft, publishPage } = await import('@/lib/models/page')
    const { ObjectId } = await import('mongodb')
    const { draftMode } = await import('next/headers')

    const tenantB = await createTenant({ name: 'L', customDomain: 'l.example.com' })
    const pageB = await createPage({ tenantId: tenantB._id, slug: 'home', title: 'Home' })

    await saveDraft(tenantB._id, pageB._id, {
      blocks: [{ type: 'text', id: 'b1', body: 'B PUBLISHED CONTENT' }],
      seo: { title: 'B published' },
    })
    await publishPage(tenantB._id, pageB._id, new ObjectId())
    await saveDraft(tenantB._id, pageB._id, {
      blocks: [{ type: 'text', id: 'b2', body: 'B OWN DRAFT CONTENT' }],
      seo: { title: 'B own draft' },
    })

    vi.mocked(draftMode).mockResolvedValue({ isEnabled: true } as never)
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u6', email: 'b@l.com', role: 'editor', tenantId: tenantB._id.toString() },
    } as never)

    const { default: TenantSitePage } = await import('@/app/_sites/[tenantId]/[slug]/page')
    const rendered = JSON.stringify(
      await TenantSitePage({ params: Promise.resolve({ tenantId: tenantB._id.toString(), slug: 'home' }) })
    )

    expect(rendered).toContain('B OWN DRAFT CONTENT')
  })
})
