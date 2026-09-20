import type { Block } from '@/lib/blocks/schema'

type HeroBlock = Extract<Block, { type: 'hero' }>

export function HeroBlockForm({ block, onChange }: { block: HeroBlock; onChange: (b: HeroBlock) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Headline</span>
        <input
          value={block.headline}
          onChange={(e) => onChange({ ...block, headline: e.target.value })}
          className="border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Subhead</span>
        <input
          value={block.subhead ?? ''}
          onChange={(e) => onChange({ ...block, subhead: e.target.value })}
          className="border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">CTA text</span>
        <input
          value={block.ctaText ?? ''}
          onChange={(e) => onChange({ ...block, ctaText: e.target.value })}
          className="border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">CTA link</span>
        <input
          value={block.ctaHref ?? ''}
          onChange={(e) => onChange({ ...block, ctaHref: e.target.value })}
          className="border p-2"
        />
      </label>
    </div>
  )
}
