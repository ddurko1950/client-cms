import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { getPage } from '@/lib/models/page'

export async function GET(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const session = await requireSession()
    const requestedTenantId = req.nextUrl.searchParams.get('tenantId') ?? undefined
    const tenantId = resolveTenantId(session, requestedTenantId)
    const { pageId } = await params
    const page = await getPage(tenantId, new ObjectId(pageId))
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ page })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
