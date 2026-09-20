import type { Block } from '@/lib/blocks/schema'

type ButtonBlock = Extract<Block, { type: 'button' }>

export function ButtonBlockForm({ block, onChange }: { block: ButtonBlock; onChange: (b: ButtonBlock) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Text</span>
        <input value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} className="border p-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Link</span>
        <input value={block.href} onChange={(e) => onChange({ ...block, href: e.target.value })} className="border p-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Style</span>
        <select
          value={block.style}
          onChange={(e) => onChange({ ...block, style: e.target.value as 'primary' | 'secondary' })}
          className="border p-2"
        >
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
        </select>
      </label>
    </div>
  )
}
