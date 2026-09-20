import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveTenantId, toObjectId } from '@/lib/api-auth'
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

  const pageObjectId = toObjectId(pageId)
  if (!pageObjectId) notFound()

  const versions = await listVersions(tenantId, pageObjectId)

  return (
    <VersionHistory
      pageId={pageId}
      tenantId={tenantId.toString()}
      versions={versions.map((v) => ({ versionNumber: v.versionNumber, publishedAt: v.publishedAt.toISOString() }))}
    />
  )
}
