import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ObjectId } from 'mongodb'
import { auth } from '@/lib/auth'
import { resolveTenantId } from '@/lib/api-auth'
import { getPage } from '@/lib/models/page'
import { BlockEditor } from '@/components/admin/BlockEditor'
import { PublishButton } from '@/components/admin/PublishButton'

export default async function EditPagePage({ params }: { params: Promise<{ pageId: string }> }) {
  const session = await auth()
  if (!session?.user) return null

  const { pageId } = await params
  const tenantId = resolveTenantId(session.user)
  const page = await getPage(tenantId, new ObjectId(pageId))
  if (!page) notFound()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{page.title}</h2>
        <div className="flex items-center gap-3">
          <Link href={`/admin/pages/${pageId}/versions`} className="text-sm underline">
            Version history
          </Link>
          <PublishButton pageId={pageId} />
        </div>
      </div>
      <BlockEditor pageId={pageId} initialBlocks={page.draft.blocks} />
    </div>
  )
}
