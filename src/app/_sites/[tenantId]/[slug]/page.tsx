import { notFound } from 'next/navigation'
import { draftMode } from 'next/headers'
import { ObjectId } from 'mongodb'
import { getPageBySlug } from '@/lib/models/page'
import { BlockRenderer } from '@/components/site/BlockRenderer'

export default async function TenantSitePage({
  params,
}: {
  params: Promise<{ tenantId: string; slug: string }>
}) {
  const { tenantId, slug } = await params
  const page = await getPageBySlug(new ObjectId(tenantId), slug)
  if (!page) notFound()

  const { isEnabled: isPreview } = await draftMode()
  const content = isPreview ? page.draft : page.published

  if (!content) notFound()

  return (
    <main>
      {content.seo.title && <title>{content.seo.title}</title>}
      <BlockRenderer blocks={content.blocks} />
    </main>
  )
}
