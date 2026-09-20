import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { resolveTenantId, toObjectId } from '@/lib/api-auth'
import { getPage } from '@/lib/models/page'
import { BlockEditor } from '@/components/admin/BlockEditor'
import { PublishButton } from '@/components/admin/PublishButton'

export default async function EditPagePage({
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

  const page = await getPage(tenantId, pageObjectId)
  if (!page) notFound()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{page.title}</h2>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/pages/${pageId}/versions?tenantId=${tenantId.toString()}`}
            className="text-sm underline"
          >
            Version history
          </Link>
          <a
            href={`/api/preview?pageId=${pageId}&tenantId=${tenantId.toString()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline"
          >
            Preview
          </a>
          <PublishButton pageId={pageId} tenantId={tenantId.toString()} />
        </div>
      </div>
      <BlockEditor
        pageId={pageId}
        tenantId={tenantId.toString()}
        initialBlocks={page.draft.blocks}
        initialSeo={page.draft.seo}
      />
    </div>
  )
}
