import { ObjectId } from 'mongodb'
import { auth } from '@/lib/auth'
import { resolveTenantId } from '@/lib/api-auth'
import { listVersions } from '@/lib/models/pageVersion'
import { VersionHistory } from '@/components/admin/VersionHistory'

export default async function VersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ pageId: string }>
  searchParams: Promise<{ tenantId?: string }>
}) {
  const session = await auth()
  if (!session?.user) return null

  const { pageId } = await params
  const { tenantId: requestedTenantId } = await searchParams
  const tenantId = resolveTenantId(session.user, requestedTenantId)
  const versions = await listVersions(tenantId, new ObjectId(pageId))

  return (
    <VersionHistory
      pageId={pageId}
      versions={versions.map((v) => ({ versionNumber: v.versionNumber, publishedAt: v.publishedAt.toISOString() }))}
    />
  )
}
