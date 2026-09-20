import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { draftMode } from 'next/headers'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { getPage } from '@/lib/models/page'

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const pageId = req.nextUrl.searchParams.get('pageId')
    if (!pageId) return NextResponse.json({ error: 'pageId is required' }, { status: 400 })

    const page = await getPage(tenantId, new ObjectId(pageId))
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const dm = await draftMode()
    dm.enable()

    return NextResponse.redirect(new URL(`/_sites/${tenantId.toString()}/${page.slug}`, req.url))
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
