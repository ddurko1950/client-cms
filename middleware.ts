import { NextRequest, NextResponse } from 'next/server'
import { getTenantByDomain } from '@/lib/models/tenant'

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/_sites')) {
    return new NextResponse('Not found', { status: 404 })
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
