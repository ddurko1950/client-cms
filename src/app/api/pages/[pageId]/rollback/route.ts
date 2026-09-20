import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId, toObjectId } from '@/lib/api-auth'
import { getPage, rollbackPage } from '@/lib/models/page'
import { getVersion } from '@/lib/models/pageVersion'

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

    const existing = await getPage(tenantId, objectId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let versionNumber: number
    try {
      ;({ versionNumber } = (await req.json()) as { versionNumber: number })
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const targetVersion = await getVersion(tenantId, objectId, versionNumber)
    if (!targetVersion) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

    const page = await rollbackPage(tenantId, objectId, versionNumber, new ObjectId(session.id))
    return NextResponse.json({ page })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
