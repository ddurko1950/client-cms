import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId, toObjectId } from '@/lib/api-auth'
import { getPage, publishPage } from '@/lib/models/page'
import { pageContentSchema } from '@/lib/blocks/schema'

export async function POST(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const session = await requireSession()
    const requestedTenantId = req.nextUrl.searchParams.get('tenantId') ?? undefined
    const tenantId = resolveTenantId(session, requestedTenantId)
    const { pageId } = await params

    const objectId = toObjectId(pageId)
    if (!objectId) {
      return NextResponse.json({ error: 'Invalid page id' }, { status: 400 })
    }

    const page = await getPage(tenantId, objectId)
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const parsed = pageContentSchema.safeParse(page.draft)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const published = await publishPage(tenantId, objectId, new ObjectId(session.id))
    return NextResponse.json({ page: published })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
