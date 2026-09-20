import { NextRequest, NextResponse } from 'next/server'
import { getTenantByDomain } from '@/lib/models/tenant'

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/_sites')) {
    // Legitimate preview redirects (from /api/preview) carry Next.js's Draft
    // Mode cookie. A bare direct hit never does. Draft-vs-published
    // authorization is still fully enforced downstream by the page itself
    // (session must match the tenant, or be superadmin) — this only stops
    // casual enumeration of tenant content via this internal routing path.
    const hasDraftCookie = req.cookies.has('__prerender_bypass')
    if (!hasDraftCookie) {
      return new NextResponse('Not found', { status: 404 })
    }
  }

  const host = req.headers.get('host') ?? ''
  const tenant = await getTenantByDomain(host)

  if (!tenant) {
    return NextResponse.next()
  }

  const rawPath = req.nextUrl.pathname.replace(/^\/+/, '')
  const slug = rawPath === '' ? 'index' : rawPath

  const url = req.nextUrl.clone()
  url.pathname = `/_sites/${tenant._id.toString()}/${slug}`
  return NextResponse.rewrite(url)
}
