import type { SessionUser } from '@/types/session'

declare module 'next-auth' {
  interface Session {
    user: SessionUser
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: SessionUser['role']
    tenantId?: SessionUser['tenantId']
  }
}
