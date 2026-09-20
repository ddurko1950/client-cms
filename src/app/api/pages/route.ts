import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, resolveTenantId } from '@/lib/api-auth'
import { listPages, createPage } from '@/lib/models/page'

const createPageSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only')
    .min(1)
    .max(80),
  title: z.string().min(1).max(200),
})

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

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession()
    const requestedTenantId = req.nextUrl.searchParams.get('tenantId') ?? undefined
    const tenantId = resolveTenantId(session, requestedTenantId)

    const body = await req.json()
    const parsed = createPageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    try {
      const page = await createPage({ tenantId, slug: parsed.data.slug, title: parsed.data.title })
      return NextResponse.json({ page }, { status: 201 })
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        return NextResponse.json({ error: 'A page with this slug already exists' }, { status: 409 })
      }
      throw err
    }
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
