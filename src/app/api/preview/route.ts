import { NextRequest, NextResponse } from 'next/server'
import { draftMode } from 'next/headers'
import { requireSession, resolveTenantId, toObjectId } from '@/lib/api-auth'
import { getPage } from '@/lib/models/page'

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession()
    const requestedTenantId = req.nextUrl.searchParams.get('tenantId') ?? undefined
    const tenantId = resolveTenantId(session, requestedTenantId)
    const pageId = req.nextUrl.searchParams.get('pageId')
    if (!pageId) return NextResponse.json({ error: 'pageId is required' }, { status: 400 })

    const objectId = toObjectId(pageId)
    if (!objectId) {
      return NextResponse.json({ error: 'Invalid page id' }, { status: 400 })
    }

    const page = await getPage(tenantId, objectId)
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const dm = await draftMode()
    dm.enable()

    return NextResponse.redirect(new URL(`/_sites/${tenantId.toString()}/${page.slug}`, req.url))
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
