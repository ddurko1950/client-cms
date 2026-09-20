import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { getPage, rollbackPage } from '@/lib/models/page'
import { getVersion } from '@/lib/models/pageVersion'

export async function POST(req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const { pageId } = await params

    let objectId: ObjectId
    try {
      objectId = new ObjectId(pageId)
    } catch {
      return NextResponse.json({ error: 'Invalid page id' }, { status: 400 })
    }

    const existing = await getPage(tenantId, objectId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { versionNumber } = (await req.json()) as { versionNumber: number }

    const targetVersion = await getVersion(tenantId, objectId, versionNumber)
    if (!targetVersion) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

    const page = await rollbackPage(tenantId, objectId, versionNumber, new ObjectId(session.id))
    return NextResponse.json({ page })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
