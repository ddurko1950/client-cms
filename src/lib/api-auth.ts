import { ObjectId } from 'mongodb'
import { auth } from '@/lib/auth'
import type { SessionUser } from '@/types/session'

export async function requireSession(): Promise<SessionUser> {
  const session = await auth()
  if (!session?.user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  return session.user
}

export function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id)
  } catch {
    return null
  }
}

export function resolveTenantId(session: SessionUser, requestedTenantId?: string): ObjectId {
  if (session.role === 'superadmin') {
    if (!requestedTenantId) {
      throw new Response(JSON.stringify({ error: 'tenantId is required for superadmin requests' }), {
        status: 400,
      })
    }
    const objectId = toObjectId(requestedTenantId)
    if (!objectId) {
      throw new Response(JSON.stringify({ error: 'Invalid tenantId' }), { status: 400 })
    }
    return objectId
  }

  if (!session.tenantId) {
    throw new Response(JSON.stringify({ error: 'No tenant assigned to this user' }), { status: 403 })
  }
  if (requestedTenantId && requestedTenantId !== session.tenantId) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }
  return new ObjectId(session.tenantId)
}
