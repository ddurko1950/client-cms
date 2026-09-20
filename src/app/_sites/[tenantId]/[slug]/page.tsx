import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { draftMode } from 'next/headers'
import { auth } from '@/lib/auth'
import { toObjectId } from '@/lib/api-auth'
import { getPageBySlug } from '@/lib/models/page'
import { BlockRenderer } from '@/components/site/BlockRenderer'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; slug: string }>
}): Promise<Metadata> {
  const { tenantId, slug } = await params
  const objectId = toObjectId(tenantId)
  if (!objectId) return {}
  const page = await getPageBySlug(objectId, slug)
  if (!page) return {}

  const { isEnabled: isPreview } = await draftMode()
  let content = page.published
  if (isPreview) {
    const session = await auth()
    const authorizedForThisTenant =
      session?.user && (session.user.role === 'superadmin' || session.user.tenantId === tenantId)
    if (authorizedForThisTenant) content = page.draft
  }

  return { title: content?.seo.title, description: content?.seo.description }
}

export default async function TenantSitePage({
  params,
}: {
  params: Promise<{ tenantId: string; slug: string }>
}) {
  const { tenantId, slug } = await params
  const objectId = toObjectId(tenantId)
  if (!objectId) notFound()

  const page = await getPageBySlug(objectId, slug)
  if (!page) notFound()

  const { isEnabled: isPreview } = await draftMode()

  let content = page.published
  if (isPreview) {
    const session = await auth()
    const authorizedForThisTenant =
      session?.user && (session.user.role === 'superadmin' || session.user.tenantId === tenantId)
    if (authorizedForThisTenant) {
      content = page.draft
    }
  }

  if (!content) notFound()

  return (
    <main>
      <BlockRenderer blocks={content.blocks} />
    </main>
  )
}
