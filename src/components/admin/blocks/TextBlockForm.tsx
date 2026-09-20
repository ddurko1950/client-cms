import type { Block } from '@/lib/blocks/schema'

type TextBlock = Extract<Block, { type: 'text' }>

export function TextBlockForm({ block, onChange }: { block: TextBlock; onChange: (b: TextBlock) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">Body</span>
      <textarea
        value={block.body}
        onChange={(e) => onChange({ ...block, body: e.target.value })}
        className="border p-2"
        rows={4}
      />
    </label>
  )
}
