import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { saveDraft } from '@/lib/models/page'
import { pageContentSchema } from '@/lib/blocks/schema'

export async function POST(req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const { pageId } = await params
    const body = await req.json()

    const parsed = pageContentSchema.safeParse(body.content)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const page = await saveDraft(tenantId, new ObjectId(pageId), parsed.data)
    return NextResponse.json({ page })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
