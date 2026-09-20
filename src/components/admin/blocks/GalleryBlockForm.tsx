import type { Block } from '@/lib/blocks/schema'

type GalleryBlock = Extract<Block, { type: 'gallery' }>

export function GalleryBlockForm({ block, onChange }: { block: GalleryBlock; onChange: (b: GalleryBlock) => void }) {
  async function updateImage(index: number, value: string) {
    const images = [...block.images]
    images[index] = value
    onChange({ ...block, images })
  }

  async function uploadImage(index: number, file: File) {
    const form = new FormData()
    form.set('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const { url } = await res.json()
    updateImage(index, url)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Images</span>
      {block.images.map((image, i) => (
        <div key={i} className="flex flex-col gap-1">
          <input value={image} onChange={(e) => updateImage(i, e.target.value)} className="border p-2" />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadImage(i, file)
            }}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...block, images: [...block.images, ''] })}
        className="self-start text-sm underline"
      >
        Add image
      </button>
    </div>
  )
}
