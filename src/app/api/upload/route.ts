import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { requireSession } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    await requireSession()
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const blob = await put(file.name, file, { access: 'public', addRandomSuffix: true })
    return NextResponse.json({ url: blob.url })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
