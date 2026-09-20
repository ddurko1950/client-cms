import { NextRequest, NextResponse } from 'next/server'
import { requireSession, resolveTenantId, toObjectId } from '@/lib/api-auth'
import { listVersions } from '@/lib/models/pageVersion'

export async function GET(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const session = await requireSession()
    const requestedTenantId = req.nextUrl.searchParams.get('tenantId') ?? undefined
    const tenantId = resolveTenantId(session, requestedTenantId)
    const { pageId } = await params

    const objectId = toObjectId(pageId)
    if (!objectId) {
      return NextResponse.json({ error: 'Invalid page id' }, { status: 400 })
    }

    const versions = await listVersions(tenantId, objectId)
    return NextResponse.json({ versions })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
