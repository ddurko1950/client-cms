import { compare } from 'bcryptjs'
import { getUserByEmail } from '@/lib/models/user'
import type { SessionUser } from '@/types/session'

export async function verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
  const user = await getUserByEmail(email)
  if (!user) return null

  const valid = await compare(password, user.passwordHash)
  if (!valid) return null

  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    tenantId: user.tenantId ? user.tenantId.toString() : null,
  }
}
