import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { getPage, saveDraft } from '@/lib/models/page'
import { pageContentSchema } from '@/lib/blocks/schema'

export async function POST(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const session = await requireSession()
    const requestedTenantId = req.nextUrl.searchParams.get('tenantId') ?? undefined
    const tenantId = resolveTenantId(session, requestedTenantId)
    const { pageId } = await params

    let objectId: ObjectId
    try {
      objectId = new ObjectId(pageId)
    } catch {
      return NextResponse.json({ error: 'Invalid page id' }, { status: 400 })
    }

    const existing = await getPage(tenantId, objectId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()

    const parsed = pageContentSchema.safeParse(body.content)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const page = await saveDraft(tenantId, objectId, parsed.data)
    return NextResponse.json({ page })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
