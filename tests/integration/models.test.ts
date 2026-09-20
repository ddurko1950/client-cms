import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

describe('tenant model', () => {
  it('creates and looks up a tenant by domain', async () => {
    const { createTenant, getTenantByDomain } = await import('@/lib/models/tenant')
    const created = await createTenant({ name: 'Acme', customDomain: 'acme.example.com' })
    const found = await getTenantByDomain('acme.example.com')
    expect(found?._id.toString()).toBe(created._id.toString())
  })

  it('returns null for an unknown domain', async () => {
    const { getTenantByDomain } = await import('@/lib/models/tenant')
    expect(await getTenantByDomain('nope.example.com')).toBeNull()
  })
})

describe('page model', () => {
  it('creates a page, saves a draft, publishes it, and creates a version', async () => {
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft, publishPage, getPage } = await import('@/lib/models/page')
    const { listVersions } = await import('@/lib/models/pageVersion')
    const { ObjectId } = await import('mongodb')

    const tenant = await createTenant({ name: 'Beta', customDomain: 'beta.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })

    const content = { blocks: [], seo: { title: 'Beta Home' } }
    await saveDraft(tenant._id, page._id, content)

    const publisherId = new ObjectId()
    const published = await publishPage(tenant._id, page._id, publisherId)
    expect(published.published).toEqual(content)
    expect(published.publishedVersion).toBe(1)

    const versions = await listVersions(tenant._id, page._id)
    expect(versions).toHaveLength(1)
    expect(versions[0].versionNumber).toBe(1)
  })

  it('rollback restores a prior version and appends a new version rather than deleting history', async () => {
    const { createTenant } = await import('@/lib/models/tenant')
    const { createPage, saveDraft, publishPage, rollbackPage } = await import('@/lib/models/page')
    const { listVersions } = await import('@/lib/models/pageVersion')
    const { ObjectId } = await import('mongodb')

    const tenant = await createTenant({ name: 'Gamma', customDomain: 'gamma.example.com' })
    const page = await createPage({ tenantId: tenant._id, slug: 'home', title: 'Home' })
    const publisherId = new ObjectId()

    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'v1' } })
    await publishPage(tenant._id, page._id, publisherId)

    await saveDraft(tenant._id, page._id, { blocks: [], seo: { title: 'v2' } })
    await publishPage(tenant._id, page._id, publisherId)

    const rolled = await rollbackPage(tenant._id, page._id, 1, publisherId)
    expect(rolled.published?.seo.title).toBe('v1')
    expect(rolled.publishedVersion).toBe(3)

    const versions = await listVersions(tenant._id, page._id)
    expect(versions).toHaveLength(3)
  })
})
