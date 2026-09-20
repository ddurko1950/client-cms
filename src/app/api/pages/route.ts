import { NextResponse } from 'next/server'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { listPages, createPage } from '@/lib/models/page'

export async function GET() {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const pages = await listPages(tenantId)
    return NextResponse.json({ pages })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    const tenantId = resolveTenantId(session)
    const { slug, title } = (await req.json()) as { slug: string; title: string }
    const page = await createPage({ tenantId, slug, title })
    return NextResponse.json({ page }, { status: 201 })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
