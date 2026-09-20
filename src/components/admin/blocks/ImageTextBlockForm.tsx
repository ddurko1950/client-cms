import type { Block } from '@/lib/blocks/schema'

type ImageTextBlock = Extract<Block, { type: 'imageText' }>

export function ImageTextBlockForm({
  block,
  onChange,
}: {
  block: ImageTextBlock
  onChange: (b: ImageTextBlock) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Image</span>
        <input value={block.image} onChange={(e) => onChange({ ...block, image: e.target.value })} className="border p-2" />
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const form = new FormData()
            form.set('file', file)
            const res = await fetch('/api/upload', { method: 'POST', body: form })
            const { url } = await res.json()
            onChange({ ...block, image: url })
          }}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Text</span>
        <textarea
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          className="border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Image position</span>
        <select
          value={block.imagePosition}
          onChange={(e) => onChange({ ...block, imagePosition: e.target.value as 'left' | 'right' })}
          className="border p-2"
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </label>
    </div>
  )
}
