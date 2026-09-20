import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))

describe('upload API', () => {
  beforeEach(() => vi.resetAllMocks())

  it('uploads a file to Vercel Blob and returns its URL', async () => {
    const { auth } = await import('@/lib/auth')
    const { put } = await import('@vercel/blob')
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'editor', tenantId: 't1', email: 'e@x.com' } } as never)
    vi.mocked(put).mockResolvedValue({ url: 'https://blob.example.com/image.png' } as never)

    const { POST } = await import('@/app/api/upload/route')
    const form = new FormData()
    form.set('file', new File(['abc'], 'image.png', { type: 'image/png' }))
    const req = new Request('http://localhost', { method: 'POST', body: form })

    const res = await POST(req)
    const body = await res.json()
    expect(body.url).toBe('https://blob.example.com/image.png')
  })

  it('returns 401 without a session', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(null as never)

    const { POST } = await import('@/app/api/upload/route')
    const form = new FormData()
    form.set('file', new File(['abc'], 'image.png', { type: 'image/png' }))
    const res = await POST(new Request('http://localhost', { method: 'POST', body: form }))
    expect(res.status).toBe(401)
  })
})
