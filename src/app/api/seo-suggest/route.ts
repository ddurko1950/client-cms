import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { suggestSeo } from '@/lib/openrouter'

export async function POST(req: NextRequest) {
  try {
    await requireSession()
    const { title, bodyText } = (await req.json()) as { title: string; bodyText: string }
    const suggestion = await suggestSeo({ title, bodyText })
    return NextResponse.json(suggestion)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
