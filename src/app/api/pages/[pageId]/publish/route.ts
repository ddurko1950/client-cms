import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { getPage, publishPage } from '@/lib/models/page'
import { pageContentSchema } from '@/lib/blocks/schema'

export async function POST(_req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const { pageId } = await params

    const page = await getPage(tenantId, new ObjectId(pageId))
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const parsed = pageContentSchema.safeParse(page.draft)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const published = await publishPage(tenantId, new ObjectId(pageId), new ObjectId(session.id))
    return NextResponse.json({ page: published })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
