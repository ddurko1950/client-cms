import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { verifyCredentials } from '@/lib/auth-credentials'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined
        if (!email || !password) return null
        return verifyCredentials(email, password)
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: 'superadmin' | 'editor' }).role
        token.tenantId = (user as { tenantId: string | null }).tenantId
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub as string
      session.user.role = token.role as 'superadmin' | 'editor'
      session.user.tenantId = (token.tenantId ?? null) as string | null
      return session
    },
  },
})
