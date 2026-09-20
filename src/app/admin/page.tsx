import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveTenantId } from '@/lib/api-auth'
import { listPages } from '@/lib/models/page'
import { listTenants } from '@/lib/models/tenant'
import { PageList } from '@/components/admin/PageList'
import { TenantSwitcher } from '@/components/admin/TenantSwitcher'

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string }>
}) {
  const session = await auth()
  if (!session?.user) return null

  const { tenantId: requestedTenantId } = await searchParams

  const tenants = session.user.role === 'superadmin' ? await listTenants() : []

  if (session.user.role === 'superadmin' && !requestedTenantId) {
    if (tenants.length === 0) {
      return <p className="text-sm text-gray-500">No tenants yet.</p>
    }
    redirect(`/admin?tenantId=${tenants[0]._id.toString()}`)
  }

  const tenantId = resolveTenantId(session.user, requestedTenantId)
  const pages = await listPages(tenantId)

  return (
    <div className="flex flex-col gap-4">
      {session.user.role === 'superadmin' && (
        <TenantSwitcher
          tenants={tenants.map((t) => ({ id: t._id.toString(), name: t.name }))}
          currentTenantId={tenantId.toString()}
        />
      )}
      <PageList
        pages={pages.map((p) => ({
          _id: p._id.toString(),
          slug: p.slug,
          title: p.title,
          publishedVersion: p.publishedVersion,
        }))}
      />
    </div>
  )
}
