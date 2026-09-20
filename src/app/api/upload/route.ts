import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { requireSession } from '@/lib/api-auth'

const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(req: Request) {
  try {
    await requireSession()
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const extension = ALLOWED_TYPES[file.type]
    if (!extension) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    const safeName = `${crypto.randomUUID()}.${extension}`
    const blob = await put(safeName, file, { access: 'public', addRandomSuffix: true, contentType: file.type })
    return NextResponse.json({ url: blob.url })
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
}
