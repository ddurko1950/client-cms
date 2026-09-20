import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { listVersions } from '@/lib/models/pageVersion'

export async function GET(_req: Request, { params }: { params: Promise<{ pageId: string }> }) {
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

    const versions = await listVersions(tenantId, objectId)
    return NextResponse.json({ versions })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
