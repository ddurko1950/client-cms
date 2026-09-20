export interface SessionUser {
  id: string
  email: string
  role: 'superadmin' | 'editor'
  tenantId: string | null
}
