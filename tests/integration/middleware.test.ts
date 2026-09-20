import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { setupTestDb, teardownTestDb } from '../helpers/db'

beforeAll(setupTestDb)
afterAll(teardownTestDb)

describe('middleware', () => {
  it('rewrites a known tenant domain to /_sites/{tenantId}/{path}', async () => {
    const { createTenant } = await import('@/lib/models/tenant')
    const tenant = await createTenant({ name: 'Acme', customDomain: 'acme.example.com' })

    const { middleware } = await import('../../middleware')
    const req = new NextRequest('https://acme.example.com/about', {
      headers: { host: 'acme.example.com' },
    })
    const res = await middleware(req)

    expect(res.headers.get('x-middleware-rewrite')).toBe(
      `https://acme.example.com/_sites/${tenant._id.toString()}/about`
    )
  })

  it('passes through unknown hosts (e.g. the app domain) unchanged', async () => {
    const { middleware } = await import('../../middleware')
    const req = new NextRequest('https://client-cms.vercel.app/admin', {
      headers: { host: 'client-cms.vercel.app' },
    })
    const res = await middleware(req)

    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('rewrites the root path "/" to /_sites/{tenantId}/index', async () => {
    const { createTenant } = await import('@/lib/models/tenant')
    const tenant = await createTenant({ name: 'Beta', customDomain: 'beta.example.com' })

    const { middleware } = await import('../../middleware')
    const req = new NextRequest('https://beta.example.com/', { headers: { host: 'beta.example.com' } })
    const res = await middleware(req)

    expect(res.headers.get('x-middleware-rewrite')).toBe(
      `https://beta.example.com/_sites/${tenant._id.toString()}/index`
    )
  })

  it('404s a direct request to /_sites on the admin domain', async () => {
    const { middleware } = await import('../../middleware')
    const req = new NextRequest('https://client-cms.vercel.app/_sites/someTenantId/someSlug', {
      headers: { host: 'client-cms.vercel.app' },
    })
    const res = await middleware(req)

    expect(res.status).toBe(404)
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('404s a direct request to /_sites even on a known tenant domain', async () => {
    const { createTenant } = await import('@/lib/models/tenant')
    const tenant = await createTenant({ name: 'Gamma', customDomain: 'gamma.example.com' })

    const { middleware } = await import('../../middleware')
    const req = new NextRequest(`https://gamma.example.com/_sites/${tenant._id.toString()}/home`, {
      headers: { host: 'gamma.example.com' },
    })
    const res = await middleware(req)

    expect(res.status).toBe(404)
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('allows a /_sites request through when it carries the Draft Mode bypass cookie (the /api/preview redirect flow)', async () => {
    const { middleware } = await import('../../middleware')
    const req = new NextRequest('https://client-cms.vercel.app/_sites/someTenantId/someSlug', {
      headers: {
        host: 'client-cms.vercel.app',
        cookie: '__prerender_bypass=some-value',
      },
    })
    const res = await middleware(req)

    expect(res.status).not.toBe(404)
  })
})
