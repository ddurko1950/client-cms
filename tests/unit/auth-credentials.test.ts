// tests/unit/auth-credentials.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import { hash } from 'bcryptjs'

vi.mock('@/lib/models/user', () => ({ getUserByEmail: vi.fn() }))

import { getUserByEmail } from '@/lib/models/user'
import { verifyCredentials } from '@/lib/auth-credentials'

describe('verifyCredentials', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns a SessionUser when the password matches', async () => {
    const passwordHash = await hash('correct-horse', 10)
    const tenantId = new ObjectId()
    vi.mocked(getUserByEmail).mockResolvedValue({
      _id: new ObjectId(),
      email: 'editor@example.com',
      passwordHash,
      role: 'editor',
      tenantId,
    })

    const result = await verifyCredentials('editor@example.com', 'correct-horse')
    expect(result).toEqual({
      id: expect.any(String),
      email: 'editor@example.com',
      role: 'editor',
      tenantId: tenantId.toString(),
    })
  })

  it('returns null when the password does not match', async () => {
    const passwordHash = await hash('correct-horse', 10)
    vi.mocked(getUserByEmail).mockResolvedValue({
      _id: new ObjectId(),
      email: 'editor@example.com',
      passwordHash,
      role: 'editor',
      tenantId: null,
    })

    expect(await verifyCredentials('editor@example.com', 'wrong')).toBeNull()
  })

  it('returns null when the user does not exist', async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null)
    expect(await verifyCredentials('nobody@example.com', 'whatever')).toBeNull()
  })

  it('returns tenantId: null for a superadmin', async () => {
    const passwordHash = await hash('adminpass', 10)
    vi.mocked(getUserByEmail).mockResolvedValue({
      _id: new ObjectId(),
      email: 'admin@example.com',
      passwordHash,
      role: 'superadmin',
      tenantId: null,
    })

    const result = await verifyCredentials('admin@example.com', 'adminpass')
    expect(result?.tenantId).toBeNull()
    expect(result?.role).toBe('superadmin')
  })
})
